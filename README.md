# Axis Player  
**A web player for viewing recordings and live video from multiple Axis cameras simultaneously**  
Uses the Axis Communications media stream library which can be found [here](https://github.com/AxisCommunications/media-stream-library-js)
  
Webserver Setup:  
- Put all files into a directory in /var/www/html/axis-player
- Access by going to your-web-server/axis-player/
   
Local Testing Setup (Windows):
- Make sure you have PHP installed
- Place all files into a directory
- Add a test.bat file with the following contents:
```
cd YOUR PHP DIRECTORY
start php.exe -S localhost:8088 -t YOUR AXIS PLAYER DIRECTORY
```
- launch test.bat and go to localhost:8088 to access the player

Usage:  
- Input Camera URL, Username, and Password into their respective fields and press 'Add' to add the camera.
- Repeat above step for as many cameras as needed.
- Use the buttons on the bottom bar to locate the desired recordings on the timeline and click on them to play the recordings.
- OR if you are looking for the closest recording past a certain time you can click on the time and the earliest recording past that point will play.
- If the player hits a time where there is no recording during playback the player will skip to the next earliest recording.
- Use 'Live' button to swap all cameras to a live view.
- Use 'Play/Pause' button to play/pause all streams.
