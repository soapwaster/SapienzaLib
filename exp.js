var express = require("express");
var firebase = require("firebase");
var user = require("./user.js");
var lodash = require("lodash");
var app = express();
const superagent = require('superagent');
const API_KEY = "AIzaSyA9XJEwv0t1vV3EwhULcFfvyNVAXwPI2So";
var bodyParser = require('body-parser');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

firebase.initializeApp({
  databaseURL:"https://sapienzalibreria-e2ea7.firebaseio.com"
});

var refDB = firebase.database().ref("bookings");
var refBookDB = firebase.database().ref("books");

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function(req, res) {
  res.send('This is the API for the Mobile Application course\n');
});

app.get('/booking/:isbn', function (req, res) {
  var uid = user.id;
  refDB.child(uid+"/"+req.params.isbn).set({
    until: "10-9-2020"
  });
  res.send("200");
});

app.get('/book/:isbn', function (req, res) {
  var isbn = req.params.isbn;
  refBookDB.child(isbn).once("value")
  .then(function(snapshot) {
    if(!snapshot.exists()){
      res.send("No book, sorry");
      return;
    }
    var gid = snapshot.val().gid;
    superagent.get('https://www.googleapis.com/books/v1/volumes/'+gid)
    .query({ key: API_KEY})
    .end((err, rest) => {
      if (err) { return; }
      res.send(rest.body.volumeInfo.title);
    });
  });

});

app.get('/book', function(req, res){
  console.log(req.query);
  var q = req.query.q || "";
  var author = req.query.author || "";
  var finalquery = q;
  if(author != ""){
    finalquery+="+inauthor:"+author;
  }

  console.log(finalquery);
  superagent.get('https://www.googleapis.com/books/v1/volumes')
  .query({ q: finalquery,key: API_KEY})
  .end((err, rest) => {
    if (err) { return; }
    var content = JSON.parse(rest.text);
    if(content.totalItems > 0){
      var books = {items: []};
      var j = content.items.length;
      for(var i=0;i<content.items.length;i++){
        (function(content){
          var element = content[i];
          console.log(element.id);
          var bookino = new Object();
          refBookDB.orderByChild("gid").equalTo(element.id).once("value")
          .then(function(snapshot) {
            j--;
            if(!snapshot.exists()){
              //res.send("No book, sorry");
            }
            else{
              bookino.title = element.volumeInfo.title;
              bookino.authors = element.volumeInfo.authors;
              bookino.publisher = element.volumeInfo.publisher;
              bookino.publishedDate = element.volumeInfo.publishedDate;
              bookino.description = element.volumeInfo.description;
              //Da sostituire con iban che ricavi da snapshot
              var keys = Object.keys(snapshot.val());
              bookino.isbn = keys[0];
              bookino.thumbnail = element.volumeInfo.imageLinks.thumbnail;
              bookino.saleinfo = element.saleInfo;
              books.items.push(lodash.cloneDeep(bookino));
            }
            if(j==0){
              res.send(books);
            }
        });
      })(content.items);
      }
    }
  });

});

app.post('/book', function(req,res){
  if(user.role != -1) return console.log("no-permission");
  var isbn = req.body.isbn;
  superagent.get('https://www.googleapis.com/books/v1/volumes')
  .query({ key: API_KEY, q: '+isbn:'+isbn })
  .end((err, rest) => {
    if (err) { return console.log(err); }
    var gbid = rest.body.items[0].id;
    refBookDB.child(isbn).set({
      gid:gbid,
      copies:10
    });
    res.send("200");
  });
});

app.listen(3000, '127.0.0.1');
