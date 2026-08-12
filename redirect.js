const http = require('http');
const port = Number(process.env.REDIRECT_PORT) || 7080;
const targetHost = '0721.gorsu.ch';

http.createServer((req, res) => {
  const url = 'https://' + targetHost + req.url;
  res.writeHead(301, {
    Location: url,
    'Cache-Control': 'no-cache'
  });
  res.end();
}).listen(port, () => {
  console.log('HTTP->HTTPS redirector running on port ' + port);
});
