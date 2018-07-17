const fs = require('fs');
const yaml = require('js-yaml');
const Koa = require('koa');
const Router = require('koa-router');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');

let config;
try {
    config = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
} catch (e) {
    console.error(e);
    process.exit(1);
}

const app = new Koa();
const router = new Router();
const port = config.port || 8080;

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        err.status = err.statusCode || err.status || 500;
        throw err;
    }
});

app.use(logger());
app.use(bodyParser());

function send(content) {
    const transporter = nodemailer.createTransport(smtpTransport({
        host: 'smtp.yandex.ru',
        port: 465,
        secureConnection: true,
        auth: {
            user: config.sender.login,
            pass: config.sender.password,
        }
    }));

    const mailOptions = {
        from: config.sender.login,
        to: config.reciever.email,
        subject: 'Заявка на участие',
        html: content,
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (err, info) => {
            transporter.close();
            if (err) {
                reject(err);
            } else {
                resolve(info);
            }
        });
    })
}

const template = (data) => `
    <h2>Сообщение от пользователя по имени ${data.name}</h2>
    <div>Email: <a href="mailto:${data.email}">${data.email}</a></div>
    <div>Phone: ${data.phone}</div>
    <br>
    <div>${data.description}</div>
`;

const logTemplate = (data) => `
    Сообщение от пользователя по имени ${data.name}
    Email: ${data.email}
    Phone: ${data.phone}
    ${data.description}
`;

router.post('/application/', async (ctx) => {
    const form = ctx.request.body;
    const { name, email, phone, description } = form;

    if (!name || !email || !description) {
        ctx.status = 400;
        ctx.body = 'Wrong request!';
        return;
    }

    console.log('Form', logTemplate(form));

    const result = await send(template(form));

    console.log('result', result);
    ctx.status = 204;
});

app
  .use(router.routes())

app.listen(port, () => {
    console.info(`Server is running on port ${port}`);
});
