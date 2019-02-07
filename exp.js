var express = require("express");
var firebase = require("firebase");

var app = express();


const superagent = require('superagent');


firebase.initializeApp({
  databaseURL:"https://sapienzalibreria-e2ea7.firebaseio.com"
});

var refDB = firebase.database().ref("bookings");

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function(req, res) {
  res.send('hello world\n');
});

app.get('/booking/:isbn', function (req, res) {
  refDB.child("1230/8989389334").set({
    until: "10-9-2020"
  });
});

app.get('/book/:isbn', function (req, res) {
  superagent.get('https://www.googleapis.com/books/v1/volumes')
  .query({ key: 'AIzaSyA9XJEwv0t1vV3EwhULcFfvyNVAXwPI2So', q: '+isbn:'+req.params.isbn })
  .end((err, rest) => {
    if (err) { return console.log(err); }
    res.send(rest.body.items[0].id);
  });
});

app.listen(3000, '127.0.0.1');
