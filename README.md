# write-game
# WritingLab

A modern, research-oriented writing tool designed to track user interaction with writing prompts and rules. Built with a minimalist macOS/iOS inspired design aesthetic.

## Features

- **Modern, Minimalist Design**: Clean UI with soft shadows, rounded corners, and a focus on user experience
- **Main Writing Area**: Large, centered text box with real-time word counting
- **Dynamic Rule System**: Evolving prompts and rules that appear based on writing milestones
- **Comprehensive Interaction Tracking**: Records every user action with timestamps
- **Firebase Integration**: Stores session data securely in Firestore
- **Mobile Responsive**: Works well on all device sizes
- **Local Draft Saving**: Automatically saves drafts in progress

## Setup Instructions

### 1. Firebase Setup

1. Create a Firebase account at [firebase.google.com](https://firebase.google.com/) if you don't have one
2. Create a new Firebase project
3. Enable Firestore Database in your project
4. Set up Firestore security rules (sample below)
5. Register a web app in your Firebase project
6. Copy your Firebase configuration (apiKey, authDomain, etc.)
7. Replace the placeholder values in `firebase.js` with your actual configuration

#### Sample Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to write to the sessions collection
    match /sessions/{sessionId} {
      allow read, write: if true;
    }
    
    // Protect other collections
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 2. Deployment with Vercel

1. Create a GitHub repository and push all files to it
2. Sign up for [Vercel](https://vercel.com/) if you don't have an account
3. Create a new project in Vercel and connect it to your GitHub repository
4. Deploy with default settings (no environment variables needed)
5. Your app will be live at the provided Vercel URL

### 3. Local Development

1. Clone the repository to your local machine
2. Open the project folder
3. Serve the files using a local development server:
   - Using Node.js: `npx serve`
   - Using Python: `python -m http.server 8000`
   - Using Visual Studio Code: Install the Live Server extension and click "Go Live"
4. Open `http://localhost:8000` (or the port specified by your server) in your browser

## File Structure

- `index.html` - Main HTML structure
- `styles.css` - All styling and animations
- `script.js` - Core application logic (writing area, rule system, event tracking)
- `firebase.js` - Firebase configuration and database operations
- `README.md` - Setup and usage instructions

## Customization Options

### Modifying Rules

Edit the `initializeRules()` function in `script.js` to:
- Change existing rules
- Add new rules with different triggers
- Modify rule completion detection logic

### Styling Changes

- Update color variables in the `:root` section of `styles.css`
- Modify spacing, border radius, and shadow values to match your design preferences
- Change fonts by updating the Google Fonts import and font-family declarations

### Form Questions

Modify the follow-up questions in the `#follow-up-form` section of `index.html`.

## Local Storage Fallback

The app includes a localStorage fallback if Firebase fails to initialize. This ensures that user data is never lost, even if there are connectivity issues.

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is free to use for personal and commercial projects.

## Future Enhancements

- User authentication
- Additional rule types (time-based, keyword-based)
- Advanced analytics dashboard
- Export options (PDF, Word)
- Custom themes and appearance settings

---

For questions or support, please open an issue on the GitHub repository.