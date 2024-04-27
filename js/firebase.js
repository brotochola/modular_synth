const firebaseConfig = {
  apiKey: "AIzaSyDw58gP1VYImF9or9dnE9WlPc3BWExGE7Y",
  authDomain: "modular-bbb10.firebaseapp.com",
  projectId: "modular-bbb10",
  storageBucket: "modular-bbb10.appspot.com",
  messagingSenderId: "286099414646",
  appId: "1:286099414646:web:09a95b5f0b3a26a5f90957",
  measurementId: "G-FD6DWLFPVV",
};

const collection = "modular";

firebase.initializeApp(firebaseConfig);

// Get a reference to the Firestore service
var firestore = firebase.firestore();
var collectionRef = firestore.collection(collection);

// Reference to the document you want to retrieve

async function getDocFromFirebase(name) {
  let doc = await collectionRef.doc(name).get();
  if (doc.exists) {
    var userData = doc.data();
    return userData;
  } else {
    // Document doesn't exist
    console.log("No such document!");
  }
}

async function saveInFireStore(obj, id) {
  var docRef = collectionRef.doc(id);
  let ret = await docRef.set(obj);
  return ret;
}

async function getAllDocuments() {
  // Reference to the collection
  let ret = {};
  // Get all documents in the collection
  let docs = await collectionRef.get();

  docs.forEach((doc) => {
    // doc.data() is the data of each document
    ret[doc.id] = doc.data();
    // console.log(doc.id, " => ", doc.data());
  });

  return ret;
}
