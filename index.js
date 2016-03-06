require('babel-register');
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const request = require('request');

const config = require('./config.js');

const client = twilio(config.accountSid, config.authToken);

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static(__dirname + '/public'));

const port = process.env.PORT || 3000; // set our port


const standardize = require('election-utils').standardize;
const primaries2016Candidates = require('election-utils').primaries2016Candidates;
const primaries2016Dates = require('election-utils').primaries2016Dates;
const Candidates = require('election-utils').Candidates;
const Candidate = require('election-utils').Candidate;

const states = ['al', 'ar', 'ak', 'co', 'ga', 'ma', 'mn', 'ok', 'tn', 'tx', 'vt', 'va'];

function toPercent(x, shorten) {

    const decimalPlaces = shorten ? 0 : 1

    if (x === 1) {

        return '100'

    } else if (x === 0) {

        return '0'

    } else if (isNaN(x)) {

        return '0'

    }

    return (100 * x).toFixed(decimalPlaces).toString()

}

function mergeDataWithRaces(races) {

    return races.map(r => {
        const candidates = r.reportingUnits[0].candidates;

        const totalVotes = Candidates.getVoteCount(candidates)

        const reporting = `${r.reportingUnits[0].precinctsReportingPct}%`;

        candidates.sort((a,b) => b.voteCount - a.voteCount );

        const output = candidates.map(c => {

            return {
                last: c.last,
                first: c.first, 
                percent: toPercent(c.voteCount / totalVotes) + '%'
            }

        }).slice(0,2)

        return {
            candidates: output,
            party: standardize.expandParty(r.party),
            reporting: reporting
        }
        
    })

}

function createMessage(data) {
    
    return data.map(d => {

        const c1 = `\n\nIn the ${d.party} race, ${d.candidates[0].first} ${d.candidates[0].last} (${d.candidates[0].percent}) leads `
        const c2 = `${d.candidates[1].first} ${d.candidates[1].last} (${d.candidates[1].percent}) `
        const c3 = `with ${d.reporting} precincts reporting.`

        return c1 + c2 + c3

    }).join(' ')

}

function validState(state) {
    

    return states.indexOf(state) > -1;
}

function getData(state, cb) {
    if (validState(state)) { 
        const url = `http://www.bostonglobe.com/electionapi/elections/2016-03-01?&level=state&officeID=P&statePostal=${state}`
        request(url, function(err, response, body) {

            if (!err && body) {
                const data = JSON.parse(body);
                if (data) {
                    const top = mergeDataWithRaces(data.races);
                    const msg = `${standardize.expandState(state)} results:${createMessage(top)}`;
                    cb(msg);
                }
            } else {
                cb('Oops sorry. My creator Russell must have made an error. Let him know.');
            }
            
        });   
    } else {
        cb(`"${state}" did not have a primary today. Try something else. Perhaps "${states[Math.floor(Math.random() * states.length)]}".`);
    }
}

// // backend routes
app.post('/message', function (req, res) {
    const d = new Date();
    const date = d.toLocaleString();

    const body = req.body;

    const input = body.Body.toLowerCase().trim();

    console.log(body);

    const help = ['help', 'hi', 'hello', 'hey', 'hola'];

    if (help.indexOf(input) > -1) {
        const msg = 'Hello citizen. Send me a state abbreviation (ex. ma) and I will tell you the latest primary results.';
        const smsResponse = new twilio.TwimlResponse();

        smsResponse.message(msg);
        
        res.writeHead(200, { 'Content-Type':'text/xml'});

        res.end(smsResponse.toString());
    }

    getData(input, function(msg) {
        const smsResponse = new twilio.TwimlResponse();

        smsResponse.message(msg);
        
        res.writeHead(200, { 'Content-Type':'text/xml'});

        res.end(smsResponse.toString());
    })
    
});




const server = app.listen(port, function() {
    console.log('Listening on port %d', server.address().port);
});
