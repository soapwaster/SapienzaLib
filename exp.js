var express = require("express");
var firebase = require("firebase");
var user = require("./user.js");
var lodash = require("lodash");
var app = express();
const superagent = require('superagent');
const API_KEY = "AIzaSyA9XJEwv0t1vV3EwhULcFfvyNVAXwPI2So";
const CLIENT_ID = "905591433407-2qlpp0afk6rdc3dtadqi23ckfu3vvjc0.apps.googleusercontent.com"
var bodyParser = require('body-parser');
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);
const session = require('express-session');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(session({secret: "Shh, its a secret!"}));
//aggiungi middleware per verificare che l'utente sia loggato, ECCETTO in alcuni casi


firebase.initializeApp({
  databaseURL:"https://sapienzalibreria-e2ea7.firebaseio.com"
});

var refDB = firebase.database().ref("bookings");
var refBookDB = firebase.database().ref("book");

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
      superagent.get('https://www.googleapis.com/books/v1/volumes')
      .query({ q: '+isbn:'+isbn  ,key: API_KEY})
      .end((err, rest) => {
        if (err) { res.send("No book, sorrys"); return; }
        //Ricerca su Firebase, dle nome del libro se esiste. Ovviamente hai 10-40 Libri quindi devi fare il matching cazzuto.
        searchTitle(res, rest, err);
      });
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
    searchTitle(res, rest, err);
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
    var gtitle = rest.body.items[0].volumeInfo.title;
    refBookDB.child(isbn).set({
      title: gtitle,
      gid:gbid,
      copies:10
    });
    res.send("200");
  });
});

app.post("/verifyUser", function(req,res){
  token = req.body.idToken;
  async function verify() {
  const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
      // Or, if multiple clients access the backend:
      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
  });

  const payload = ticket.getPayload();
  const userid = payload['sub'];
  const useremail = payload['email'];

  req.session.id=userid;
  req.session.mat=useremail.split("@")[0].split(".")[1];
  // If request specified a G Suite domain:
  //const domain = payload['hd'];
  }
  verify().catch(console.error);
});

function searchTitle(res, rest, err){
  if (err) { return; }
  var content = JSON.parse(rest.text);
  if(content.totalItems > 0){
    var books = {items: []};
    var j = content.items.length;
    for(var i=0;i<content.items.length;i++){
      (function(content){
        var element = content[i];
        console.log(element.volumeInfo.title);
        var bookino = new Object();
        refBookDB.orderByChild("title").equalTo(element.volumeInfo.title).once("value")
        .then(function(snapshot) {
          j--;
          if(!snapshot.exists()){
            //res.send("No book, sorryss");
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
}

app.listen(3000, '127.0.0.1');
