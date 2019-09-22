const request = require('request');
const util = require('util');
const fs = require('fs');
const csvWriter = require('csv-write-stream');

const apikey = require('../serviceAccount.json').pretalx_api;
const host = 'https://pretalx.com';
const eventName = 'fso2019';
const headers = {
  'Authorization': apikey,
  'Accept': 'application/json',
};

const url = `${host}/api/events/${eventName}/submissions`;

const requestP = util.promisify(request);

const getSubmissions = ({ url, collection, resolve, reject }) => {
  return requestP({ url, headers })
  .then((res) => res.body)
  .then(JSON.parse)
  .then((data) => {
    collection.push(...data.results);
    if (data.next !== null) {
      return getSubmissions({ url: data.next, collection, resolve, reject });
    } else {
      resolve(collection);
    }
  });
};


const main = () => {
  const writer = csvWriter();
  writer.pipe(fs.createWriteStream('submissions.csv'));
  let collection = [];
  getSubmissions({ url, collection, resolve: (submissions) => {
    submissions.forEach((submission) => {
      if (!(submission.state === 'submitted')) return;
      writer.write({
        id: submission.code,
        type: submission.submission_type.en,
        title: submission.title,
        abstract: submission.abstract,
      });
    });
  } }).then(() => {
    writer.end();
  });
};

main();
