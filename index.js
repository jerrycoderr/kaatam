const Spotify = require('../lib/spotify');
const downloader = require('../lib/downloader');
const Parser = require('../lib/parser');

// Instantiate the Spotify class so it can be used directly
const spotifyInstance = new Spotify();

// Attach the downloader function as a method if they want it on the same object
spotifyInstance.download = downloader;

// Attach the classes just in case they need to create new instances elsewhere
spotifyInstance.Spotify = Spotify;
spotifyInstance.Parser = Parser;

module.exports = spotifyInstance;
