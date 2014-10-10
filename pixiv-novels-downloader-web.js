var express = require('express');
var morgan = require('morgan');
var ejs = require('ejs');
var bodyParser = require('body-parser');
var request = require('request');
var cheerio = require('cheerio');
var entities = require('entities');
var favicon = require('serve-favicon');

var config = require('./config');

request = request.defaults({
	jar: true
});

var app = express();

app.use(morgan('combined'));
app.use(favicon(__dirname + '/favicon.ico'));
app.use(bodyParser.urlencoded({extended: false}));

app.engine('html', ejs.renderFile);

app.get('/', function (req, res) {
	res.render('index.html');
});

app.post('/', function (req, res) {
	var url = req.body.url;

	if (!url) {
		res.status(500);
		return;
	}

	var id;
	var idMatch = url.match(/[\?&]id=([^&]+)&?/);

	if (idMatch) {
		id = idMatch[1];
	} else {
		id = url;
	}

	var sessionJar = request.jar();

	request({
		url: 'https://www.secure.pixiv.net/login.php',
		method: 'POST',
		form: {
			mode: 'login',
			pixiv_id: config.user,
			pass: config.pass
		},
		jar: sessionJar
	}, function (error, response, body) {
		request({
			url: 'http://www.pixiv.net/novel/show.php?id=' + id,
			method: 'GET',
			jar: sessionJar
		}, function (error, response, body) {
			if (error || response.statusCode !== 200) {
				res.status(500);
				return;
			}

			var $ = cheerio.load(body);

			var title = $('#wrapper > div.layout-body > div > div.layout-column-2 > div > section.work-info > h1').text();
			var author = $('#wrapper > div.layout-body > div > div.layout-column-1 > div > div._unit.profile-unit > a > h1').text();
			var date = $('#wrapper > div.layout-body > div > div.layout-column-2 > div > section.work-info > ul > li:nth-child(1)').text();
			var caption = entities.decodeHTML($('#wrapper > div.layout-body > div > div.layout-column-2 > div > section.work-info > p').html()).replace(/<br>/g, '\n');
			var tags = [];
			$('li.tag > .text').each(function () {
				tags.push($(this).text());
			});
			var novel = $('#novel_text').text();

			var compiled =
				title + '\n' +
				author + '\n' +
				date + '\n\n' +
				caption + '\n\n' +
				tags.join('、') + '\n' +
				'――――――――――\n\n' +
				novel + '\n';

			res.send(JSON.stringify({
				id: id,
				title: title,
				author: author,
				caption: caption,
				tags: tags,
				compiled: compiled
			}));
		});
	});
});

var server = app.listen(config.port, function () {
	console.log('Listening on port %d', server.address().port);
});
