var express = require('express');
var app = express();
var exphbs  = require('express-handlebars');
var session = require('express-session');
var mongoose = require('mongoose');
var bparse = require('body-parser');
var fs = require('fs');	
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var User = require('./models/user');
var siofu = require("socketio-file-upload");

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
app.use(express.static(__dirname + '/uploads'));

// MongoDB Database init
mongoose.connect('mongodb://139.59.74.8:27017/chat-app',{useMongoClient: true});
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
app.use(session({ secret: 'anything' }));
app.use(passport.initialize());
app.use(passport.session());

// File uploader init
app.use(siofu.router);

passport.use(new LocalStrategy(
  function(username, password, done) {
   User.getUserByUsername(username, function(err, user){
   	if(err) throw err;
   	if(!user){
   		return done(null, false, {message: 'Unknown User'});
   	}

   	User.comparePassword(password, user.password, function(err, isMatch){
   		if(err) throw err;
   		if(isMatch){
   			return done(null, user);
   		} else {
   			return done(null, false, {message: 'Invalid password'});
   		}
   	});
   });
  }));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.getUserById(id, function(err, user) {
    done(err, user);
  });
});

app.get('/', function(req, res){
  res.redirect('register');
});

app.get('/register', function(req, res){
  res.render('register');
});

app.post('/register',function(req,res) {
	var username = req.body.username;
	var password = req.body.password;
	var color = '#' + parseInt(Math.random() * 0xffffff).toString(16);
	var newUser = new User({
		username: username,
		password: password,
		color:color
	});
	User.createUser(newUser, function(err, user){
		if(err) throw err;
		console.log(user);
	});
        res.redirect('/login');
});

app.get('/login', function(req, res) {
  res.render('login', {user: req.user});
});

app.post('/login',
passport.authenticate('local', {successRedirect:'/chat'}),
function(req, res) {
    req.session.user = req.user;
	res.redirect('/chat');
});

var users = [],x=0;
io.on('connection', function(socket){
	socket.on('login', function(data){
	    console.log('a user ' + data.userId + ' connected');
	    var found = false;
	    for(var i = 0; i < users.length; i++) {
		    if (users[i].username == data.userId) {
		        found = true;
		        break;
		    }
		}
	    if(data.userId){
	    	if(!found)
				users.push({socket:socket.id,username:data.userId});
			else{
				for(var i = 0; i < users.length; i++) {
				    if (users[i].username == data.userId) {
				        users[i].socket = socket.id;
				    }
				}
	    	}
			
		}
		io.emit('online users', users);
	});
	socket.on('disconnect', function(){
		console.log('user ' + users[socket.id] + ' disconnected');
		io.emit('user disconnected',socket.id)
	});
	socket.on('typing', function (data) {
	  socket.broadcast.emit('typing', data);
	});
	socket.on('chat message', function(msg){
		Msg.find({},function(err,document) {
			var message = new Msg({
				msg:msg
			});
			message.save();
		})
	io.emit('new message', msg);
	});
	var uploader = new siofu();
    uploader.dir = __dirname + "/uploads";
    uploader.listen(socket);

    uploader.on("start", function(event){
		if (/\.exe$/.test(event.file.name)) {
			console.log("Aborting: " + event.file.id);
			uploader.abort(event.file.id, socket);
		}
	});

    // Do something when a file is saved:
    uploader.on("saved", function(event){
        io.emit('uploaded',event.file.name);
    });

    // Error handler:
    uploader.on("error", function(event){
        console.log("Error from uploader", event);
    });
});

app.get('/chat', redirectToChatIfLoggedIn,function(req,res) {
	Msg.find({},function(err,document) {
		res.render('chat',{messages:document,user:req.user});
	})
});

app.get('/logout',redirectToChatIfLoggedIn, function(req, res){
	req.session.destroy(function (err) {
		res.redirect('/login');  	
	});
});

function redirectToChatIfLoggedIn(req, res, next) {
	if (!req.isAuthenticated()){
		return res.render('login');
	}
	return next();
}


http.listen(port, function(){
  console.log('listening on *:' + port);
});
