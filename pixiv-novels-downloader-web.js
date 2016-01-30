const express = require('express');
const morgan = require('morgan');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const req = require('request');
const cheerio = require('cheerio');
const entities = require('entities');
const favicon = require('serve-favicon');

const config = require('./config');

const request = req.defaults({
	jar: true
});

const app = express();

app.use(morgan('combined'));
app.use(favicon(`${__dirname}/favicon.ico`));
app.use(bodyParser.urlencoded({extended: false}));

app.engine('html', ejs.renderFile);

app.get('/', (req, res) => {
	res.render('index.html');
});

app.post('/', (req, res) => {
	const url = req.body.url;

	if (!url) {
		res.status(500);
		return;
	}

	var id;
	const idMatch = url.match(/[\?&]id=([^&]+)&?/);

	if (idMatch) {
		id = idMatch[1];
	} else {
		id = url;
	}

	const sessionJar = request.jar();

	request({
		url: 'https://www.secure.pixiv.net/login.php',
		method: 'POST',
		form: {
			mode: 'login',
			pixiv_id: config.user,
			pass: config.pass
		},
		jar: sessionJar
	}, (error, response, body) => {
		request({
			url: `http://www.pixiv.net/novel/show.php?id=${id}`,
			method: 'GET',
			jar: sessionJar
		}, (error, response, body) => {
			if (error || response.statusCode !== 200) {
				res.status(500);
				return;
			}

			const $ = cheerio.load(body);

			const title = $('#wrapper > div.layout-body > div > div.layout-column-2 > div > section.work-info > h1').text();
			const author = $('#wrapper > div.layout-body > div > div.layout-column-1 > div > div._unit.profile-unit > a > h1').text();
			const date = $('#wrapper > div.layout-body > div > div.layout-column-2 > div > section.work-info > ul > li:nth-child(1)').text();
			const caption = entities.decodeHTML($('#wrapper > div.layout-body > div > div.layout-column-2 > div > section.work-info > p').html()).replace(/<br>/g, '\n');
			const tags = [];
			$('li.tag > .text').each((index, element) => {
				tags.push($(element).text());
			});
			var novel = $('#novel_text').text();

			// preprocess novel text

			novel = novel.replace(/《/g, '≪').replace(/》/g, '≫');
			novel = novel.replace(/､/g, '、').replace(/｡/g, '。');
			novel = novel.replace(/｢/g, '「').replace(/｣/g, '」');
			novel = novel.replace(/\)/g, '）').replace(/\(/g, '（');
			novel = novel.replace(/!/g, '！').replace(/\?/g, '？');
			novel = novel.replace(/([！？]+)([^！？」』）\s])/g, '$1　$2');
			novel = novel.replace(/([！？]{2,})/g, '［＃縦中横］$1［＃縦中横終わり］');
			novel = novel.replace(/\[\[rb:(.+?)\s*>\s*(.+?)\]\]/g, '｜$1《$2》');
			novel = novel.replace(/\[chapter:(.+?)\]/g, '［＃中見出し］$1［＃中見出し終わり］');
			novel = novel.replace(/\[newpage\]/g, '［＃改ページ］');

			const compiled = `
				${title}
				${author}
				${date}

				${caption}

				${tags.join('、')}
				――――――――――

				${novel}
			`.replace(/^\n/, '').replace(/^\t+/mg, '');

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

const server = app.listen(config.port, () => {
	console.log('Listening on port %d', server.address().port);
});
