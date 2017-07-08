var express = require('express');
var app = express();
var exphbs  = require('express-handlebars');
var mongoose = require('mongoose');
var bparse = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

//Handlebars init
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// Body-parser init
app.use(bparse.urlencoded({ extended: false }));
app.use(bparse.json());

// Static files
app.use(express.static(__dirname + '/public'));

// MongoDB Database init
mongoose.connect('mongodb://127.0.0.1:27017/chat-app',{useMongoClient: true});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('LOGGED | MongoDB Connected - ' + new Date());
});

// Message Collection
var MessageSchema = mongoose.Schema({
    msg:Object
});
var Msg = mongoose.model('msg', MessageSchema);

// passport config
app.use(passport.initialize());
app.use(passport.session());
var User = require('./models/user');
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/', function(req, res){
  res.render('register');
});

app.post('/register',function(req,res) {
	User.register(new User({ username : req.body.username }), req.body.password, (err, account) => {
        if (err) {
          return res.render('register', { error : err.message });
        }

        passport.authenticate('local')(req, res, () => {
	        if (err) {
	            return next(err);
	        }
	        res.redirect('/chat');
        });
    });
});

app.get('/login', function(req, res) {
	console.log(req.user);
  res.render('login', {user: req.user});
});

app.post('/login', passport.authenticate('local'), function(req, res) {
	console.log(req.user);
    res.redirect('/chat');
});

io.on('connection', function(socket){
	console.log('connected');
	socket.on('typing', function (data) {
	  console.log(data);
	  socket.broadcast.emit('typing', data);
	});
	socket.on('chat message', function(msg){
		console.log(msg);
		Msg.find({},function(err,document) {
			var message = new Msg({
				msg:msg
			});
			message.save();
		})
	io.emit('new message', msg.msg);
	});
});

app.get('/chat',function(req,res) {
	Msg.find({},function(err,document) {
		res.render('chat',{messages:document});
	})
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
