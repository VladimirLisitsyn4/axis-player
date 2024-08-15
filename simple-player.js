const { pipelines, isRtcpBye } = window.mediaStreamLibrary

///////////////////////////////////////////////////////////////////////////
//
// AXIS
//
///////////////////////////////////////////////////////////////////////////
const axis_authorize = async (host) => {
  // Force a login by fetching usergroup
  const fetchOptions = {
    credentials: 'include',
    headers: {
      'Axis-Orig-Sw': true,
      'X-Requested-With': 'XMLHttpRequest',
    },
    mode: 'no-cors',
  }
  try {
    await window.fetch(`http://${host}/axis-cgi/usergroup.cgi`, fetchOptions)
  } catch (err) {
    console.error(err)
  }
}

function axis_records_(host, start, stop, user, pass) {

  const fetchOptions = {
    credentials: 'include',
    headers: {
      'Axis-Orig-Sw': true,
      'X-Requested-With': 'XMLHttpRequest',
	  'Accept-Encoding': 'gzip, deflate',
	  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    },
    mode: 'no-cors',
  }

fetch(`http://${host}/axis-cgi/record/list.cgi?listentity=recording&starttime=${start}&stoptime=${stop}`, fetchOptions).then(function(response) {
  return response.text();
}).then(function(data) {
  console.log(data);
}).catch(function(err) {
  console.log('Fetch Error :-S', err);
});
}

async function axis_records3(host, start, stop, user, pass) {

  const fetchOptions = {
    credentials: 'include',
    headers: {
      'Axis-Orig-Sw': true,
      'X-Requested-With': 'XMLHttpRequest',
    },
    mode: 'no-cors',
  }
  try {
    
	const response = await window.fetch(`http://${host}/axis-cgi/record/list.cgi?listentity=recording&starttime=${start}&stoptime=${stop}&eventid=Continuous`, fetchOptions)
	const result = await response.json();

  } catch (err) {
    console.error(err)
  }

}


function axis_records(start, stop, current_stream) {
	$.ajax({
	  method: "POST",
	  url: "curl.php",
	  data: {text: `http://${current_stream.user}:${current_stream.pass}@${current_stream.host}/axis-cgi/record/list.cgi?listentity=recording&starttime=${start}&stoptime=${stop}`}
	})
  .done(function( response ) {

	$( "#records" ).html("");	  
	xmlDoc = $.parseXML( response );
	let recs = xmlDoc.querySelectorAll("recording");
	  
	recs.forEach(function(el){
			
		var st = new Date(el.getAttribute('starttime'));
		var et;
			
		if (el.getAttribute('stoptime') != '')
			et = new Date(el.getAttribute('stoptime'));
		else
			et = new Date();
			
	slider_add_time_record("#mywrapper1",st, et, el.getAttribute('recordingid'), current_stream);
	});
	
	current_stream.jump_to_end()

  });
}

function axis_play_rec(rec_id, stream) {
	let input_pipeline = stream.pipeline
	if (typeof input_pipeline != "undefined") {
		input_pipeline.close()
	 }

	let rtsp_url_rec = stream.rtsp_url + '&recordingid=' + rec_id;
	new_pipeline = play(rtsp_url_rec, stream)

	return new_pipeline
}



///////////////////////////////////////////////////////////////////////////
//
// COMMON
//
///////////////////////////////////////////////////////////////////////////
const play = (rtsp_url, stream, play_time = 0) => {
	let Pipeline = pipelines.Html5VideoPipeline
	let mediaElement = document.getElementById(stream.player_name)

  
	// Setup a new pipeline
	let pipeline = new Pipeline({
		ws: { uri: `ws://${stream.user}:${stream.pass}@${stream.host}/${stream.ws_path}` },
		rtsp: { uri: `${rtsp_url}` },
		mediaElement,
	})

  pipeline.ready.then(() => {
    pipeline.rtsp.play(play_time)
  })

  return pipeline
}



// Each time a device ip is entered, authorize and then play
const playButton = document.querySelector('#play')
const pauseButton = document.querySelector('#pause')
const liveButton = document.querySelector('#to_live');
const slider = document.getElementById("time_slider");
const cameraRadio = document.querySelectorAll('input[name=camera]')

const host_el = document.querySelector('#host_el')
const ws_path_el = document.querySelector('#ws_path_el')
const user_el = document.querySelector('#user_el')
const pass_el = document.querySelector('#pass_el')
const rtsp_url_el = document.querySelector('#rtsp_url_el')

let active_streams = []; // Stores Stream Objects
let type = "None";

		function eventListener(stream, new_search) {
			var msg = "rec_id - " + stream.records[stream.current_index].id +", rec_pos - " + stream.rec_pos;
			console.log(msg);
			let input_pipeline = stream.pipeline

			if (typeof input_pipeline != "undefined") {
				input_pipeline.rtsp.stop();
			}

            if (new_search) {
				stream.pipeline = axis_play_rec(stream.records[stream.current_index].id, stream)
				stream.pipeline.rtsp.play(stream.rec_pos)
			} else {
				input_pipeline.rtsp.play(stream.rec_pos)
			}
		}


slider_init("#mywrapper1",eventListener);

function addVideoPlayer() {
    const videoContainer = document.getElementById('video_container');
    const playerCount = videoContainer.children.length;
    const newPlayerId = `video_player_${playerCount + 1}`;

    const video = document.createElement('video');
    video.id = newPlayerId;
    video.autoplay = true;
    video.style.width = '360px';
    video.style.height = '240px';
    video.style.border = '1px solid black';

    videoContainer.appendChild(video);
    return newPlayerId;
}

function handle_video_end(slider) {
	if (!slider.userInteracting) {
		let all_ended = true
		let time_detached = false
		let current_time;

		// Check if all streams have ended
		for (let index = 0; index < active_streams.length; index++) {
			if (!document.getElementById(active_streams[index].player_name).ended && active_streams[index].active) {
				all_ended = false
			} else {
				active_streams[index].active = false
				// Take note if there is now no stream with time attached
				if (active_streams[index].time_attached) {
					active_streams[index].time_attached = false
					time_detached = true
					let player = document.getElementById(active_streams[index].player_name);
					current_time = new Date(active_streams[index].records[active_streams[index].current_index].starttime.getTime() + (active_streams[index].rec_pos + player.currentTime)*1000);
				}
			}
		}

		if (all_ended)
			video_end(eventListener, active_streams, current_time)

		// If time has been detached it needs to be attached to a running stream
		if (time_detached) {
			for (let index = 0; index < active_streams.length; index++) {
				if (active_streams[index].active) {
					active_streams[index].time_attached = true
					break
				}
			}
		}
	}
}

function go_live() {
	let now = new Date();
	now = roundMinutes(now);
	let endtime = now;
	let starttime = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours back
	slider_set_time_range("#mywrapper1", starttime, endtime);

	// Assign proper info to each stream and start playing live video
	for (let i = 0; i < active_streams.length; i++) {
		let stream = active_streams[i]
		stream.active = true;
		stream.rec_pos = 0;
		stream.time_attached = false;
		stream.is_live = true;
		stream.jump_to_end();
		stream.pipeline = play(stream.rtsp_url, stream);
	}
	active_streams[0].time_attached = true;
}

for (let radio of cameraRadio) {

	radio.addEventListener('click', function() {
    
		type = this.id;

		host_el.value = "";
		user_el.value = "";
		pass_el.value = "";	
		
		// This code can be implemented if the player needs to work with multiple types of cameras
		// if (this.id == "None")
		// {
		// 	host_el.value = "";
		// 	ws_path_el.value = "";
		// 	user_el.value = "";
		// 	pass_el.value = "";
		// 	rtsp_url_el.value = ""
		// } 
		// else if (this.id == "AXIS")
		// {
		// 	host_el.value = "";
		// 	ws_path_el.value = "";
		// 	user_el.value = "";
		// 	pass_el.value = "";
		// 	rtsp_url_el.value = ""
		// } 
		// else if (this.id == "AXIS-2")
		// {
		// 	host_el.value = "";
		// 	ws_path_el.value = "";
		// 	user_el.value = "";
		// 	pass_el.value = "";
		// 	rtsp_url_el.value = ""
		// }	
    });
}

function roundMinutes(date) {

    date.setHours(date.getHours() + Math.round(date.getMinutes()/60));
    date.setMinutes(0, 0, 0); // Resets also seconds and milliseconds

    return date;
}

playButton.addEventListener('click', async () => {
	let main_slider = document.querySelector('#mywrapper1').querySelector("input");

	rtsp_url_el.value = "rtsp://" + host_el.value + "/axis-media/media.amp?videocodec=h264";
	ws_path_el.value = "rtsp-over-websocket";
    let current_stream = new Stream(host_el.value, ws_path_el.value, rtsp_url_el.value, user_el.value, pass_el.value);
    console.log(current_stream.host, current_stream.ws_path);

	// This code can be implemented if the player needs to work with multiple types of cameras
    // if (type === "AXIS" || type === "AXIS-2") {
    //     let stoptime = new Date();
    //     let starttime = new Date(stoptime.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days back
    //     axis_records(starttime.toISOString(), stoptime.toISOString(), current_stream);
    // }

	let stoptime = new Date();
    let starttime = new Date(stoptime.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days back
    axis_records(starttime.toISOString(), stoptime.toISOString(), current_stream);

    const playerName = addVideoPlayer();

	// Creates a new line every 2 streams added
	if ((active_streams.length+1) % 2 == 0)
		document.getElementById('video_container').appendChild(document.createElement("br"))

    current_stream.player_name = playerName;

	let pipeline = play(current_stream.rtsp_url, current_stream);
    current_stream.pipeline = pipeline;

    if (active_streams.length == 0) 
		current_stream.time_attached = true;

	document.getElementById(current_stream.player_name).addEventListener("timeupdate", function() {current_stream.handle_time_update(main_slider)});
    document.getElementById(current_stream.player_name).addEventListener("ended", function() {handle_video_end(main_slider)});

	active_streams.push(current_stream);
	go_live()
});

pauseButton.addEventListener('click', async () => {
	for (let index = 0; index < active_streams.length; index++) {
		let stream = active_streams[index]
		
		if (stream.pipeline && stream.pipeline.rtsp._state === "playing")
			stream.pipeline.rtsp.pause();
		else if (stream.pipeline && stream.pipeline.rtsp._state === "paused") {
			if (stream.is_live)
				go_live() // Using the rtsp.play command doesnt unpause live video on some streams, to ensure every stream plays I am using go_live
			else
				stream.pipeline.rtsp.play(0);
		}
	}
});

liveButton.addEventListener('click', function() {go_live()});

class Stream {
	constructor(host, ws_path, rtsp_url, user, pass) {
		this.user = user;
		this.pass = pass;
		this.host = host;
		this.rtsp_url = rtsp_url;
		this.ws_path = ws_path;
		this.pipeline;
		this.player_name; // Stores the id of the player this stream is assigned to
		this.records = [];
		this.current_index = 0;
		this.rec_pos = 0; // Starting position in currently playing recording
		this.active = false; // Is the stream playing anything?
		this.is_live = false; // Is the stream live?
		this.time_attached = false; // If this is true this stream's info will be used in update_slider, only 1 stream should have this at a time 
	}

	jump_to_end() {
		this.current_index = this.records.length - 1
	}

	handle_time_update(slider) {
		if (!slider.userInteracting && this.time_attached)
			update_slider(this, slider)
	}
}