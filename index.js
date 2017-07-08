var express = require('express');
var app = express();
var exphbs  = require('express-handlebars');
var mongoose = require('mongoose');
var bparse = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var passportLocalMongoose = require('passport-local-mongoose');

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
mongoose.connect('mongodb://127.0.0.1:27017/chat-app');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('LOGGED | MongoDB Connected - ' + new Date());
});

// User Collection
var UserSchema = mongoose.Schema({
    username: String,
    password: String
});
var User = mongoose.model('user', UserSchema);

User.plugin(passportLocalMongoose);

// Message Collection
var MessageSchema = mongoose.Schema({
    msg:Object
});
var Msg = mongoose.model('msg', MessageSchema);

// passport config
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/', function(req, res){
  res.render('home');
});

app.post('/',function(req,res) {
	if(req.body.flag==1){
		User.register(new User({ username : req.body.username }), req.body.password, function(err, account) {
	        if (err) {
	            return res.render('register', { account : account });
	        }

	        passport.authenticate('local')(req, res, function () {
	            res.redirect('/chat');
	        });
	    });
	}
})

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
