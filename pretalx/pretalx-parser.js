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

const defaultData = require('../docs/default-firebase-data.json')
const targetData = {...defaultData}
const targetDataFile = './docs/firebase-data.json'

const confirmedTalksOnly = false

const eventsUriWorkshops = `${host}/api/events/${eventWorkshop}/${confirmedTalksOnly ? 'talks' : 'submissions'}`
const eventsUriMain = `${host}/api/events/${eventMain}/${confirmedTalksOnly ? 'talks' : 'submissions'}`

const speakersUriWorkshops = `${host}/api/events/${eventWorkshop}/speakers`
const speakersUriMain = `${host}/api/events/${eventMain}/speakers`

const requestP = util.promisify(request)

const categorisationQuestion = (question) => question.id === 180
const complexityQuestion = (question) => question.id === 170

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

const transformSpeaker = (speaker) => {
  return {[speaker.code]: {
    name: speaker.name,
    bio: speaker.biography,
    shortBio: speaker.biography,
    photoUrl: speaker.avatar
  }}
}

const requestForTalks = (url) => {
  return requestP({url, headers})
  .then(res => res.body)
  .then(JSON.parse)
  .then(data => {
    // TODO filter out unsucessful talks
    const presentations = Object.assign(...data.results.map(transformTalk))
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

const main = () => {
  // Mutates "targetData"
  Promise.all([
    requestForTalks(eventsUriWorkshops),
    requestForTalks(eventsUriMain),
    requestForSpeakers(speakersUriWorkshops),
    requestForSpeakers(speakersUriMain)
  ]).then(() => {
    fs.writeFileSync(targetDataFile, JSON.stringify(targetData, null, 2), 'utf8')
  }).catch(error => {
    console.error(error)
    process.exit(1)
  }).finally(() => {
    process.exit(0)
  })
}

main()
