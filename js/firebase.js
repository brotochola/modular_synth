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

const USER_STALE_MS = 15000;

function usersCollection(patchName) {
  return collectionRef.doc(patchName).collection("users");
}

function liveCollection(patchName) {
  return collectionRef.doc(patchName).collection("live");
}

function normalizePatchUser(doc) {
  let data = doc.data() || {};
  data._id = doc.id;
  if (!data.sessionID) data.sessionID = doc.id;
  return data;
}

function isPatchUserStale(user, now, staleMs) {
  now = now || Date.now();
  staleMs = staleMs == null ? USER_STALE_MS : staleMs;
  return !user || now - (user.lastSeen || 0) > staleMs;
}

function filterLivePatchUsers(users, now, staleMs) {
  return (users || []).filter((u) => !isPatchUserStale(u, now, staleMs));
}

async function addMeAsUserInThisPatchInFirebase(patchName, presence) {
  if (!patchName) return console.warn("no patch name");
  let sessionID = presence && presence.sessionID;
  if (!sessionID) return console.warn("no session id");
  console.log("#addMeAsUserInThisPatchInFirebase", sessionID, presence.userID);
  return usersCollection(patchName)
    .doc(sessionID)
    .set({
      userID: presence.userID,
      sessionID,
      peerId: presence.peerId || null,
      admin: !!presence.admin,
      lastSeen: Date.now(),
    });
}

async function heartbeatMeInThisPatchInFirebase(patchName, sessionID, extra) {
  if (!patchName || !sessionID) return;
  let payload = Object.assign({ lastSeen: Date.now() }, extra || {});
  return usersCollection(patchName).doc(sessionID).set(payload, { merge: true });
}

async function removeMeAsUserInThisPatchInFirebase(patchName, sessionID) {
  console.log("#removeMeAsUserInThisPatchInFirebase", sessionID);
  if (!patchName || !sessionID) return console.warn("no patch name");
  let usersDel = usersCollection(patchName).doc(sessionID).delete();
  let liveDel = liveCollection(patchName).doc(sessionID).delete();
  try {
    await usersDel;
  } catch (e) {}
  try {
    await liveDel;
  } catch (e) {}
}

function writeLivePresence(patchName, sessionID, data) {
  if (!patchName || !sessionID || !data) return;
  liveCollection(patchName)
    .doc(sessionID)
    .set(data, { merge: true })
    .catch((e) => console.warn("#live write failed", e));
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
  if (!patchName) return;
  collectionRef.doc(patchName).set({ bpm: bpm }, { merge: true });
}

// ponytail: Firestore transport is backup while PeerJS retries; no Cristian lock here.
async function putTransportInFireStore(patchName, data) {
  if (!patchName || !data) return;
  collectionRef.doc(patchName).set(data, { merge: true });
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
  ret.cables = loadadDoc.cables;
  ret.outputX = loadadDoc.outputX;
  ret.outputY = loadadDoc.outputY;
  ret.playing = loadadDoc.playing;
  ret.beatOriginMs = loadadDoc.beatOriginMs;

  docs.forEach((doc) => {
    ret.components.push(doc.data());
  });

  //PUT CONNECTIONS IN ONE SINGLE ARRAY, THE SAME FORMAT AS I'M SAVING LOCALLY
  ret.components.map((k) =>
    (k.connections || []).map((c) => {
      ret.connections.push(c);
    })
  );

  if (ret.components.length == 0) {
    let listed = (loadadDoc.components || []).length;
    if (listed) {
      console.warn(
        "patch lists " +
          listed +
          " modules but firestore has no component docs. Open the patch locally and save again.",
      );
    }
    return null;
  }

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
  return (await usersCollection(patchName).get()).docs.map(normalizePatchUser);
}

function listenToChangesInUsersConnectedToThisPatch(patchName, cb) {
  return usersCollection(patchName).onSnapshot((col) => {
    if (cb instanceof Function) cb(col.docs.map(normalizePatchUser));
  });
}

function listenToLivePresence(patchName, cb) {
  return liveCollection(patchName).onSnapshot((snap) => {
    if (cb instanceof Function) cb(snap);
  });
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

(function checkPresenceHelpers() {
  let now = 100000;
  let live = { lastSeen: now - 1000 };
  let dead = { lastSeen: now - 20000 };
  if (isPatchUserStale(live, now, 15000)) {
    throw new Error("isPatchUserStale live");
  }
  if (!isPatchUserStale(dead, now, 15000)) {
    throw new Error("isPatchUserStale dead");
  }
  if (filterLivePatchUsers([live, dead, null], now, 15000).length != 1) {
    throw new Error("filterLivePatchUsers");
  }
})();
