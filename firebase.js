// Firebase Configuration and Setup

// Firebase configuration object
// Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBxROGMAGcC8fPq656sgMpE8FYvDgKp7Nk",
  authDomain: "write-stories-c72f9.firebaseapp.com",
  projectId: "write-stories-c72f9",
  storageBucket: "write-stories-c72f9.firebasestorage.app",
  messagingSenderId: "175374872570",
  appId: "1:175374872570:web:42e780a1ce1f73e2047e43",
  measurementId: "G-QP2FKQEWM2"
};

// Initialize Firebase
let db;

try {
    // Initialize Firebase app
    firebase.initializeApp(firebaseConfig);
    
    // Initialize Firestore
    db = firebase.firestore();
    
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Error initializing Firebase:", error);
    
    // Create a fallback db object that stores data locally if Firebase fails
    db = createLocalStorageDb();
}

// Fallback implementation using localStorage if Firebase fails to initialize
function createLocalStorageDb() {
    console.warn("Using localStorage as fallback database");
    
    return {
        collection: function(collectionName) {
            return {
                doc: function(docId) {
                    return {
                        set: function(data) {
                            return new Promise((resolve, reject) => {
                                try {
                                    // Create a key using collection and document ID
                                    const storageKey = `${collectionName}_${docId}`;
                                    
                                    // Store data in localStorage
                                    localStorage.setItem(storageKey, JSON.stringify(data));
                                    
                                    console.log(`Data saved to localStorage with key: ${storageKey}`);
                                    resolve();
                                } catch (error) {
                                    console.error("Error saving to localStorage:", error);
                                    reject(error);
                                }
                            });
                        },
                        get: function() {
                            return new Promise((resolve, reject) => {
                                try {
                                    const storageKey = `${collectionName}_${docId}`;
                                    const data = localStorage.getItem(storageKey);
                                    
                                    if (data) {
                                        resolve({
                                            exists: true,
                                            data: function() {
                                                return JSON.parse(data);
                                            }
                                        });
                                    } else {
                                        resolve({
                                            exists: false
                                        });
                                    }
                                } catch (error) {
                                    reject(error);
                                }
                            });
                        }
                    };
                }
            };
        }
    };
}

// Add a simple error handler for Firebase operations
function handleFirebaseError(operation, error) {
    console.error(`Firebase ${operation} error:`, error);
    
    // Display user-friendly error message
    if (typeof showError === 'function') {
        showError("There was a problem connecting to the database. Your data will be saved locally.");
    }
}

// Function to test Firebase connection
function testFirebaseConnection() {
    return new Promise((resolve, reject) => {
        try {
            const testDoc = db.collection('test').doc('connection_test');
            
            testDoc.set({
                timestamp: new Date().toISOString(),
                success: true
            })
            .then(() => {
                console.log("Firebase connection test successful");
                resolve(true);
            })
            .catch(error => {
                console.warn("Firebase connection test failed:", error);
                resolve(false);
            });
        } catch (error) {
            console.warn("Firebase test error:", error);
            resolve(false);
        }
    });
}

// Export a function to check if we're using the Firebase implementation or the fallback
function isUsingFirebase() {
    return typeof firebase !== 'undefined' && firebase.apps.length > 0;
}
