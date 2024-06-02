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

// async function createDocInFirestore(patchName, serializedOutputComponent) {
//   await collectionRef
//     .doc(patchName)
//     .collection("components")
//     .doc("output")
//     .set(serializedOutputComponent);
// }

// COLLECTION -> DOC -> COLLECTION OF COMPONENTS -> DOC WITH COMPONENT
async function createInstanceOfComponentInFirestore(
  patchName,
  serializedComponent
) {
  // console.log("# creating instance of components", patchName, serializedComponent, serializedComponent.id)
  let ret = await collectionRef
    .doc(patchName)
    .collection("components")
    .doc(serializedComponent.id)
    .set(serializedComponent);

  return ret;
}

async function addMeAsUserInThisPatchInFirebase(patchName, userID, admin) {
  console.log("#addMeAsUserInThisPatchInFirebase", userID);
  if (!patchName) return console.warn("no patch name");
  let ret = await collectionRef
    .doc(patchName)
    .collection("users")
    .doc(userID)
    .set({ userID, admin });

  return ret;
}

async function removeMeAsUserInThisPatchInFirebase(patchName, userID) {
  console.log("#removeMeAsUserInThisPatchInFirebase", userID);
  if (!patchName) return console.warn("no patch name");
  let ret = await collectionRef
    .doc(patchName)
    .collection("users")
    .doc(userID)
    .delete();

  return ret;
}

async function createBase64FileInFirebase(patchName, base64, filename) {
  console.log("#saving file", filename);
  if (!patchName) return console.warn("no patch name");
  let ret = await collectionRef
    .doc(patchName)
    .collection("files")
    .doc(filename)
    .set({ base64 });

  return ret;
}

async function getBase64FileFromFirebase(patchName, filename) {
  if (!patchName) return console.warn("no patch name");

  return (
    await (
      await collectionRef.doc(patchName).collection("files").doc(filename)
    ).get()
  ).data();
}

async function putBPMInFireStore(patchName, bpm) {
  collectionRef.doc(patchName).set({ bpm: bpm });
}

async function removeComponentFromFirestore(patchName, id) {
  collectionRef.doc(patchName).collection("components").doc(id).delete();
}

async function getListOfComponentsFromFirestore(patchName) {
  let docs = await collectionRef.doc(patchName).collection("components").get();

  return docs.docs.map((k) => k.id);
}

async function getDocFromFirebase(name) {
  let ret = { components: [], connections: [], outputX: null, outputY: null };
  let docs = await collectionRef.doc(name).collection("components").get();
  let loadadDoc = (await collectionRef.doc(name).get()).data() || {};

  ret.bpm = loadadDoc.bpm;
  ret.outputX = loadadDoc.outputX;
  ret.outputY = loadadDoc.outputY;

  docs.forEach((doc) => {
    ret.components.push(doc.data());
  });

  //PUT CONNECTIONS IN ONE SINGLE ARRAY, THE SAME FORMAT AS I'M SAVING LOCALLY
  ret.components.map((k) =>
    (k.connections || []).map((c) => {
      ret.connections.push(c);
    })
  );

  if (ret.components.length == 0) return null;

  return ret;
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
    console.log(doc.id, " => ", doc.data());
  });

  return ret;
}

function listenToChangesInWholePatch(docName, cb) {
  // console.log("# listen to changes", docName, componentID)
  const docRef = firebase.firestore().collection("modular").doc(docName);

  let refToUnsubscribe = docRef.onSnapshot((doc) => {
    const data = doc.data();
    if (cb instanceof Function) {
      cb(data);
    }
  });
  return refToUnsubscribe;
}

async function getAllUsersConnected(patchName) {
  return (
    await firebase
      .firestore()
      .collection("modular")
      .doc(patchName)
      .collection("users")
      .get()
  ).docs.map((k) => k.data());
}

function listenToChangesInUsersConnectedToThisPatch(patchName, cb) {
  // console.log("# listen to changes", docName, componentID)
  const usersCollection = firebase
    .firestore()
    .collection("modular")
    .doc(patchName)
    .collection("users");

  let refToUnsubscribe = usersCollection.onSnapshot((col) => {
    if (cb instanceof Function) {
      getAllUsersConnected(patchName).then((users) => {
        cb(users);
      });
    }
  });

  getAllUsersConnected(patchName).then((users) => {
    cb(users);
  });

  return refToUnsubscribe;
}

function listenToChangesInComponent(docName, componentID, cb) {
  // console.log("# listen to changes", docName, componentID)
  const docRef = firebase
    .firestore()
    .collection("modular")
    .doc(docName)
    .collection("components")
    .doc(componentID);

  let refToUnsubscribe = docRef.onSnapshot((doc) => {
    const data = doc.data();
    if (cb instanceof Function) {
      cb(data);
    }
  });
  return refToUnsubscribe;
}

async function getComponentFromFirestore(docName, componentID, cb) {
  // console.log("# listen to changes", docName, componentID)
  let doc = await collectionRef
    .doc(docName)
    .collection("components")
    .doc(componentID)
    .get();

  if (cb instanceof Function) {
    cb(doc.data());
  }
}
