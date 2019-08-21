const request = require('request')
const util = require('util')
const _ = require('lodash')
const fs = require('fs')

// TODO
// - once confirmations are made: confirmedTalksOnly = true
// - handle pagination

const apikey = require('../serviceAccount.json').pretalx_api

const host = "https://pretalx.com";
const eventWorkshop = "fso2019w"
const eventMain = "fso2019"
const headers = {
  "Authorization": apikey
};

const targetData = require('../docs/default-firebase-data.json')
const targetDataFile = './docs/firebase-data.json'

const confirmedTalksOnly = false
// TODO bit funky here: can we just use "talks" rather than the crafty logic with includedStatuses?
const includeStatuses = ['accepted', 'confirmed', 'submitted']

const eventsUriWorkshops = `${host}/api/events/${eventWorkshop}/${confirmedTalksOnly ? 'talks' : 'submissions'}`
const eventsUriMain = `${host}/api/events/${eventMain}/${confirmedTalksOnly ? 'talks' : 'submissions'}`

const speakersUriWorkshops = `${host}/api/events/${eventWorkshop}/speakers`
const speakersUriMain = `${host}/api/events/${eventMain}/speakers`

const requestP = util.promisify(request)

const categorisationQuestion = (question) => question.id === 180
const complexityQuestion = (question) => question.id === 170
const homeQuestion = (question) => question.id === 194
const workplaceQuestion = (question) => question.id === 192
const jobTitleQuestion = (question) => question.id === 193

const transformTalk = (talk) => {
  return {[talk.code]: {
    description: talk.abstract, // talk.description?
    tags: [(_.find(talk.answers, q => categorisationQuestion(q.question)) || {}).answer].filter(Boolean).map(String),
    language: "English",
    title: talk.title,
    speakers: talk.speakers.map(speaker => speaker.code),
    complexity: (_.find(talk.answers, q => complexityQuestion(q.question)) || {}).answer || null
  }}
}

// Note: this returns all speakers; they are later filtered according to whether
// they correspond to a confirmed session
const transformSpeaker = (speaker) => {
  const jobTitle = (_.find(speaker.answers, q => jobTitleQuestion(q.question)) || {}).answer
  const workplace = (_.find(speaker.answers, q => workplaceQuestion(q.question)) || {}).answer
  const home = (_.find(speaker.answers, q => homeQuestion(q.question)) || {}).answer
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

const requestForTalks = (url) => {
  return requestP({url, headers})
  .then(res => res.body)
  .then(JSON.parse)
  .then(data => {
    const presentations = Object.assign(...data.results.filter(t => includeStatuses.includes(t.state)).map(transformTalk))
    targetData.sessions = {...targetData.sessions, ...presentations}
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
    requestForTalks(eventsUriWorkshops),
    requestForTalks(eventsUriMain),
    requestForSpeakers(speakersUriWorkshops),
    requestForSpeakers(speakersUriMain)
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
