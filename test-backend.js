
const https = require('https');

const url = 'https://oraclealeo.onrender.com//prices';
console.log(`Testing ${url}...`);

https.get(url, (res) => {
    console.log(`Status: ${res.statusCode}`);
}).on('error', (err) => {
    console.log('Error:', err.message);
});
