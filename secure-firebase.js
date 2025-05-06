// Firebase Configuration and Setup

// Firebase configuration object
// Replace these values with your actual Firebase project config from Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Set to true to force using localStorage instead of Firebase
// Set this to true if you're having issues with Firebase
let forceLocalStorage = false;

// Initialize Firebase
let db;

try {
    console.log("Initializing Firebase...");
    
    // Check if we should use localStorage fallback
    if (forceLocalStorage) {
        throw new Error("Using localStorage mode");
    }
    
    // Check if Firebase SDK is available
    if (typeof firebase === 'undefined') {
        throw new Error("Firebase SDK not loaded");
    }
    
    // Initialize Firebase app
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Initialize Firestore
    db = firebase.firestore();
    
    console.log("Firebase initialized successfully");
    
    // Test the connection
    testFirebaseConnection().then(isConnected => {
        if (!isConnected) {
            console.warn("Firebase connection test failed, using localStorage fallback");
            db = createLocalStorageDb();
            
            // Hide loading indicator if it's showing
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator && !loadingIndicator.classList.contains('hidden')) {
                loadingIndicator.classList.add('hidden');
            }
        }
    });
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

// Function to test Firebase connection
function testFirebaseConnection() {
    return new Promise((resolve, reject) => {
        try {
            // Set a short timeout to fail fast if Firebase isn't responding
            const timeoutId = setTimeout(() => {
                console.warn("Firebase connection test timed out");
                resolve(false);
            }, 5000); // 5 second timeout
            
            const testDoc = db.collection('test').doc('connection_test');
            
            testDoc.set({
                timestamp: new Date().toISOString(),
                success: true
            })
            .then(() => {
                clearTimeout(timeoutId);
                console.log("Firebase connection test successful");
                resolve(true);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.warn("Firebase connection test failed:", error);
                resolve(false);
            });
        } catch (error) {
            console.warn("Firebase test error:", error);
            resolve(false);
        }
    });
}

// Make createLocalStorageDb available globally for script.js
window.createLocalStorageDb = createLocalStorageDb;

// Force hide loading indicator after 8 seconds to prevent infinite loading
setTimeout(() => {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator && !loadingIndicator.classList.contains('hidden')) {
        console.warn("Force hiding loading indicator after timeout");
        loadingIndicator.classList.add('hidden');
    }
}, 8000);
