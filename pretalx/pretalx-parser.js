const request = require('request')
const util = require('util')
const _ = require('lodash')
const fs = require('fs')
const moment = require('moment-timezone')

// TODO
// - handle pagination for main talks?

const apikey = require('../serviceAccount.json').pretalx_api

const host = "https://pretalx.com";
const eventWorkshop = "fso2019w"
const eventMain = "fso2019"
const headers = {
  "Authorization": apikey
};

const targetData = require('../docs/default-firebase-data.json')
const targetDataFile = './docs/firebase-data.json'

// In theory, this should be true for "final" use. But there's a bug in the
// response at the /talks endpoint in that it only returns talks that have been
// confirmed PRIOR to the most recent release of the schedule.
// This script can instead just use the /submissions?state=confirmed data
// to work around this and will be just fine.
const confirmedTalksOnly = false
const includeStatuses = ['confirmed']

const talksUriWorkshops = `${host}/api/events/${eventWorkshop}/${confirmedTalksOnly ? 'talks' : 'submissions'}`
const talksUriMain = `${host}/api/events/${eventMain}/${confirmedTalksOnly ? 'talks' : 'submissions'}`

const speakersUriWorkshops = `${host}/api/events/${eventWorkshop}/speakers`
const speakersUriMain = `${host}/api/events/${eventMain}/speakers`

const requestP = util.promisify(request)

const workshopSkillQuestion = (question) => question.id === 168
const complexityQuestion = (question) => question.id === 170
const stuffToBringQuestion = (question) => question.id === 176
const categorisationQuestion = (question) => question.id === 180
const homeQuestion = (question) => question.id === 194
const workplaceQuestion = (question) => question.id === 192
const jobTitleQuestion = (question) => question.id === 193


const transformTalk = (talk) => {
  const submissionType = (talk.submission_type || {}).en
  const tags = [
    (_.find(talk.answers, a => categorisationQuestion(a.question)) || {}).answer,
    submissionType,
    talk.track
  ].filter(Boolean).map(String)
  description = `${talk.abstract}\n\n## Details\n\n${talk.description}`
  let skillLevel
  if (submissionType === 'Workshop') {
    skillLevel = (_.find(talk.answers, a => workshopSkillQuestion(a.question)) || {}).answer
    const skillsInfo = (_.find(talk.answers, a => complexityQuestion(a.question)) || {}).answer
    description += `\n\n### Skill level\n\n**${skillLevel}**\n\n${skillsInfo}`
    const bringInfo = (_.find(talk.answers, a => stuffToBringQuestion(a.question)) || {}).answer
    description += `\n\n### Things to bring and stuff to do beforehand\n\n${bringInfo}`
  }
  return {[talk.code]: {
    description,
    tags,
    language: (talk.content_locale.startsWith('en') ? "English" : talk.content_locale) || "English",
    title: talk.title,
    speakers: talk.speakers.map(speaker => speaker.code),
    complexity: skillLevel || null,
    image: (talk.image || "").replace("http://", "https://") || null, // Avoid mixed content
  }}
}

const talkInSchedule = (talk) => {
  const slot = talk.slot
  const startTime = moment(slot.start)
  // Assumes a session starts and ends on the same day...
  const day = startTime.format('YYYY-MM-DD')
  const dateReadable = startTime.format('ddd MMM do')
  const timeslot = {
    startTime: startTime.format('HH:mm'),
    endTime: moment(slot.end).format('HH:mm'),
    session: {"items": [talk.code]},
    day
  }
  const track = {
    "title": slot.room.en
  }
  return {timeslot, track}
}

// Note: this returns all speakers; they are later filtered according to whether
// they correspond to a confirmed session
const transformSpeaker = (speaker) => {
  const jobTitle = (_.find(speaker.answers, a => jobTitleQuestion(a.question)) || {}).answer
  const workplace = (_.find(speaker.answers, a => workplaceQuestion(a.question)) || {}).answer
  const home = (_.find(speaker.answers, a => homeQuestion(a.question)) || {}).answer
  return {[speaker.code]: {
    name: speaker.name,
    bio: speaker.biography,
    shortBio: speaker.biography,
    photoUrl: speaker.avatar || undefined,
    title: jobTitle || undefined,
    company: workplace || undefined,
    country: home || undefined
  }}
}

const transformTalkForSchedule = ({timeslot, track}) => {
  // Note: forgive me Father for I have sinned...
  // The Hoverboard schedule data structure is... unpleasant.
  const scheduleDay = targetData.schedule[timeslot.day]
  let tracks = scheduleDay['tracks']
  const preDefinedTracks = tracks.length
  let existingTimeslots = scheduleDay['timeslots']

  // Handle track
  const existingTrack = _.find(tracks, t => t.title === track.title)
  if (!existingTrack) {
    tracks.push(track)
  }
  const trackOrdinal = _.findIndex(tracks, t => t.title === track.title) || 0

  // Handle timeslots
  const existingTimeslot = _.find(existingTimeslots, slot => slot.startTime == timeslot.startTime && slot.endTime == timeslot.endTime)
  if (existingTimeslot) {
    existingTimeslot.sessions[trackOrdinal] = timeslot.session
    existingTimeslot.sessions = Array.from(existingTimeslot.sessions, s => s == null ? ({"items": []}) : s)
  } else {
    let sessions = _.map(_.range(0, trackOrdinal), x => ({"items": []}))
    sessions[trackOrdinal] = timeslot.session
    sessions = sessions.map(s => s == null ? ({"items": []}) : s)
    existingTimeslots.push({
      startTime: timeslot.startTime,
      endTime: timeslot.endTime,
      sessions
    })
  }
  // Keep timeslots sorted
  targetData.schedule[timeslot.day].timeslots = _.sortBy([...existingTimeslots], 'startTime')
}

const requestForTalks = (url) => {
  console.log({url})
  return requestP({url, headers})
  .then(res => res.body)
  .then(JSON.parse)
  .then(data => {
    const filteredTalks = data.results.filter(t => includeStatuses.includes(t.state))
    const presentations = Object.assign(...filteredTalks.map(transformTalk))
    targetData.sessions = {...targetData.sessions, ...presentations}

    const scheduleData = filteredTalks.map(talkInSchedule)
    scheduleData.forEach(transformTalkForSchedule)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
}

const requestForSpeakers = (url) => {
  return requestP({url, headers})
  .then(res => res.body)
  .then(JSON.parse)
  .then(data => {
    const speakers = Object.assign(
      ..._.map(
        _.filter(data.results, speaker => (speaker.submissions || []).length > 0),
        transformSpeaker
      )
    )
    targetData.speakers = {...targetData.speakers, ...speakers}
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })}

const filterOutSpeakersWithoutConfirmedSession = () => {
  // Filter out speakers without successful presentations/workshops
  // CAUTION: we're mutating targetData
  allSpeakers = Object.keys(targetData.speakers)
  confirmedSessionSpeakers = _.uniq(Object.keys(targetData.sessions).reduce((acc, cur) => {
    const speakers = targetData.sessions[cur].speakers || []
    return [...acc, ...speakers]
  }))
  allSpeakers.forEach(speaker => {
    if (targetData.speakers[speaker].featured) {
      // Featured speakers are special cases (e.g. Keynote)
      return
    } else if (confirmedSessionSpeakers.includes(speaker)) {
      // This speaker has a confimed talk
      return
    } else {
      // Need to eliminate this speaker as they have no confirmed session
      delete targetData.speakers[speaker];
    }
  })
}

const main = () => {
  // Mutates "targetData"
  Promise.all([
    requestForTalks(talksUriWorkshops),
    // requestForTalks(talksUriMain),
    requestForSpeakers(speakersUriWorkshops),
    // requestForSpeakers(speakersUriMain)
  ]).then(filterOutSpeakersWithoutConfirmedSession)
  .then(() => {
    fs.writeFileSync(targetDataFile, JSON.stringify(targetData, null, 2), 'utf8')
  }).catch(error => {
    console.error(error)
    process.exit(1)
  }).then(() => {
    process.exit(0)
  })
}

main()
