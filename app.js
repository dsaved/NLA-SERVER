var socketConfig = require('./socketConfig');
var mysql = require('mysql');
const mysqlDB = require('./library/mysql');
const functions = require('./helpers/functions');
var Configuration = require('./library/Configs');
global.baseDir = __dirname;

var express = require('express');
const listener = require('./socket')

const cors = require('cors');
const logger = require('./middleware/logger');

var app = express();
var http = socketConfig.isSecure ? require('https') : require('http');
var server = socketConfig.isSecure ? http.createServer(socketConfig.cert, app) : http.createServer(app);
var io = require('socket.io')(server, { origins: "*" });

app.use(cors());
app.disable('etag')

app.use(express.urlencoded({ extended: true }));
app.use(express.json())
app.use(express.static('public'))

var sqlConn;
const conf = Configuration.getConfig();

// app.use(logger); // log all request
require('./router')(app); // set up routers

app.use(function(req, res, next) {
    res.status(404);
    res.send({ success: false, message: '404 page not found' });
});

// create mysql connection to database
sqlConn = mysql.createConnection(conf.db_config);
sqlConn.connect(function(err) {
    if (err) return console.log(err);
    listener.start(io, conf.db_config)
    server.listen(conf.socket_port, async() => {
        console.log('Server listening on :%d', conf.socket_port);
    });
});


//send sms to all agents whose license is about to expire withen a month and withen a week
setInterval(async() => {
    const db = new mysqlDB(conf.db_config);
    var time = getTime()
    if (time === "06:00:00") {
        const fields = `user.id,user.name,user.phone,user.gender,user.address,user.account_type,user.code,user.status,user.created,lc.license_type,lc.vendor_limit,lc.acquired,lc.expires`

        const query1 = `SELECT ${fields} FROM license lc LEFT JOIN users user ON user.id=lc.user_id WHERE DATE(DATE_SUB(lc.expires, INTERVAL 1 MONTH)) = DATE(NOW());`
        await db.query(query1);
        if (db.count() > 0) {
            const results = db.results();
            for (let index = 0; index < results.length; index++) {
                const agent = results[index];
                const endDate = new Date(agent.expires);
                const today = new Date();
                const diff = functions.getDateDiff(today, endDate);
                await functions.sendSMS(agent.phone, `Hello ${agent.name}, your license will be expiring in ${diff} days. Please do well do renew it. thanks`);
                console.log(agent)
            }
        }

        const query2 = `SELECT ${fields} FROM license lc LEFT JOIN users user ON user.id=lc.user_id WHERE DATE(DATE_SUB(lc.expires, INTERVAL 2 WEEK)) = DATE(NOW());`
        await db.query(query2);
        if (db.count() > 0) {
            const results = db.results();
            for (let index = 0; index < results.length; index++) {
                const agent = results[index];
                const endDate = new Date(agent.expires);
                const today = new Date();
                const diff = functions.getDateDiff(today, endDate);
                await functions.sendSMS(agent.phone, `Hello ${agent.name}, your license will be expiring in ${diff} days. Please do well do renew it. thanks`);
                console.log(agent)
            }
        }
    }
}, 10000);


function getTime(dateTime) {
    function pad(s) { return (s < 10) ? '0' + s : s; }
    if (dateTime) {
        var today = new Date();
        var time = [pad(today.getFullYear()), pad(today.getMonth() + 1), today.getDate()].join('-') + " " + today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
        return time;
    }
    var today = new Date();
    var time = pad(today.getHours()) + ":" + pad(today.getMinutes()) + ":" + pad(today.getSeconds());
    return time;
}