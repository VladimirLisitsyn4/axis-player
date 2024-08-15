
const debounce = (callback, wait) => {
    let timeoutId = null;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback(...args);
      }, wait);
    };
}

function record_binary_search(records, time) {
    let low = 0;
    let high = records.length - 1;

    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        let record = records[mid];

        if (time >= record.starttime && time < record.endtime)
            return {found: true, index: mid};
        else if (time < record.starttime)
            high = mid - 1;
        else
            low = mid + 1;
    }

    return {found: false, index: low}; // Return the closest index for future records
}

function slider_init(id, listener) {
	const wrapper = document.querySelector(id);
	const input = wrapper.querySelector("input");
	const buttons = wrapper.querySelectorAll("button");
	const output_time = wrapper.querySelector("output[name='time']");
	input.output_time = output_time;
	input.min = 0;
	input.max = 0;
	input.value = 0;
	input.curtime = 0;
    input.userInteracting = false;

    const findVideo = debounce((event) => {
        let time = new Date(input.starttime.getTime() + Math.round(event.target.value)*1000);
		input.curtime = time;
		output_time.textContent = time.toLocaleString();
		const streams = active_streams;
		let matched_records = [];
		let next_records = [];
		let streams_to_terminate = [];

		for (let index = 0; index < streams.length; index++) {
			let found = false;
			let current_stream = streams[index]

			if (current_stream.is_live)
				current_stream.is_live = false;

			// If the new timestamp is is within the current video skip to the new timestamp
			if (time >= current_stream.records[current_stream.current_index].starttime && time < current_stream.records[current_stream.current_index].endtime)
				matched_records.push([current_stream, current_stream.current_index, (time.getTime() - current_stream.records[current_stream.current_index].starttime.getTime())/1000, false])
			else {
				let result = record_binary_search(current_stream.records, time);
		
				// If a video is found containing the timestamp it can be played alongside other videos that match
				if (result.found) {
					matched_records.push([current_stream, result.index, (time.getTime() - current_stream.records[result.index].starttime.getTime()) / 1000, true]);
					found = true;
				}
		
				if (!found) {
					// If no matching videos have been found then add the next matching record to next_records
					if (result.index < current_stream.records.length && matched_records.length == 0) {
						next_records.push([current_stream, result.index]);
						found = true;
					} else
						streams_to_terminate.push(current_stream)
				}
			}
		}
			
		if (matched_records.length != 0) { // If any matched records exist then they are played and streams which dont have matching records are shut down
			let assigned_time_attachment = true

			for (let index = 0; index < next_records.length; index++) {
				let current_stream = next_records[index][0]
				current_stream.active = false
				if (current_stream.time_attached)
					assigned_time_attachment = false
				current_stream.time_attached = false
				if (typeof current_stream.pipeline != "undefined")
					current_stream.pipeline.rtsp.stop()
				document.getElementById(current_stream.player_name).src = ""
			}
			
			for (let index = 0; index < streams_to_terminate.length; index++) {
				let current_stream = streams_to_terminate[index]
				current_stream.active = false
				if (current_stream.time_attached)
					assigned_time_attachment = false
				current_stream.time_attached = false
				if (typeof current_stream.pipeline != "undefined")
					current_stream.pipeline.rtsp.stop()
				document.getElementById(current_stream.player_name).src = ""
			}

			for (let index = 0; index < matched_records.length; index++) {
				let current_record = matched_records[index]
				let stream = current_record[0]
				stream.current_index = current_record[1]
				stream.rec_pos = current_record[2]
				stream.active = true
				if (!assigned_time_attachment) {
					stream.time_attached = true
					assigned_time_attachment = true
				}
				listener(stream, current_record[3])
			}
		} else {
			for (let index = 0; index < streams.length; index++) { // All streams are preemptively shut down and then started as need
				let current_stream = streams[index]
				current_stream.active = false
				current_stream.time_attached = false
				if (typeof current_stream.pipeline != "undefined")
					current_stream.pipeline.rtsp.stop()

				document.getElementById(current_stream.player_name).src = ""
			}

			let earliest_time = new Date(8640000000000000); // Maximum possible date
			let assigned_time_attachment = false

			// Find earliest time
			for (let index = 0; index < next_records.length; index++) {
				let checking_time = next_records[index][0].records[next_records[index][1]].starttime
				if (checking_time.getTime() <= earliest_time.getTime())
					earliest_time = checking_time
			}

			// Play all streams that have a record at the earliest time
			for (let index = 0; index < next_records.length; index++) {
				let stream = next_records[index][0]
				let checking_time = stream.records[next_records[index][1]].starttime
				if (checking_time.getTime() == earliest_time.getTime()) {
					stream.current_index = next_records[index][1]
					stream.rec_pos = 0
					input.curtime = earliest_time;
					input.output_time.textContent = input.curtime.toLocaleString();
					stream.active = true
					if (!assigned_time_attachment) {
						stream.time_attached = true
						assigned_time_attachment = true
					}
					listener(stream, true)
				}
			}
		}
			
    }, 250)

    const blockMovement = debounce((event) => {
        input.userInteracting = true;
        setTimeout(() => {
            input.userInteracting = false;
        }, 1000);
    })

    input.addEventListener("input", blockMovement)

	input.addEventListener("change", findVideo);

	buttons.forEach(function(elem) {
		elem.addEventListener("click", (event) => {
			
			if (event.target.name == "plus")
			{
				let st = new Date(input.starttime.getTime() + input.max/4*1000);
				let et = new Date(st.getTime() + input.max/2*1000);
				
				slider_set_time_range(id, st, et);
				_slider_draw_time_marks(id);				
			}

			if (event.target.name == "minus")
			{
				let st = new Date(input.starttime.getTime() - input.max/2*1000);
				let et = new Date(st.getTime() + input.max*2*1000);
				
				slider_set_time_range(id, st, et);								
				_slider_draw_time_marks(id);				
			}

			if (event.target.name == "next")
			{
				let st = new Date(input.starttime.getTime() + input.max*1000/2);
				let et = new Date(st.getTime() + input.max*1000);
				
				slider_set_time_range(id, st, et);
				_slider_draw_time_marks(id);				
			}

			if (event.target.name == "prev")
			{
				let st = new Date(input.starttime.getTime() - input.max*1000/2);
				let et = new Date(st.getTime() + input.max*1000);
				
				slider_set_time_range(id, st, et);
				_slider_draw_time_marks(id);				
				
			}
		
		});
	});
			
	_slider_draw_time_marks(id);	
}

function update_slider(stream, slider) {
	if (stream.records.length > 0 && !stream.is_live) {
		const player = document.getElementById(stream.player_name);
		const timeInVideo = (stream.rec_pos + player.currentTime)*1000;
		const newSliderPos = (stream.records[stream.current_index].starttime.getTime() + timeInVideo - slider.starttime.getTime())/1000;

		slider.value = newSliderPos
		slider.output_time.textContent = new Date(stream.records[stream.current_index].starttime.getTime() + (stream.rec_pos + player.currentTime)*1000).toLocaleString();

		// If any streams that weren't active before have a record on the current timestamp start playing them
		const streams = active_streams;
		let time = new Date(slider.starttime.getTime() + Math.round(slider.value)*1000);
		for (let index = 0; index < streams.length; index++) {
			let stream = streams[index];
			if (!stream.active) {
				let low = 0;
				let high = stream.records.length - 1;
				let foundIndex = -1;

				while (low <= high) {
					let mid = Math.floor((low + high) / 2);
					let midTime = stream.records[mid].starttime.getTime();

					if (midTime <= time.getTime()) {
						if (time < stream.records[mid].endtime) {
							foundIndex = mid;
							break;
						}
						low = mid + 1;
					} else
						high = mid - 1;
				}

				if (foundIndex !== -1) {
					stream.current_index = foundIndex;
					stream.rec_pos = 0;
					stream.active = true;
					eventListener(stream, true);
				}
			}
		}
	} else if (stream.is_live) {
		let now = new Date(Date.now())
		const newSliderPos = (now.getTime() - slider.starttime.getTime())/1000

		slider.value = newSliderPos
		slider.output_time.textContent = now.toLocaleString();
	}
}

function video_end(listener, streams, current_time) {
	let earliest_time = new Date(8640000000000000); // Maximum possible date
	let new_records = []

	// Stop all streams and find the next earliest next record
	for (let index = 0; index < streams.length; index++) {
        let stream = streams[index];

        stream.active = false;
        stream.pipeline.rtsp.stop();
        document.getElementById(stream.player_name).src = "";

		let low = 0;
	    let high = stream.records.length - 1;
    	let closestIndex = -1;

	    while (low <= high) {
    	    let mid = Math.floor((low + high) / 2);
        	let midTime = stream.records[mid].starttime.getTime();

	        if (midTime > current_time) {
    	        closestIndex = mid; // This might be the earliest time after current_time
        	    high = mid - 1;
	        } else
    	        low = mid + 1;
    	}

        if (closestIndex !== -1) {
            let checking_time = stream.records[closestIndex].starttime;
            if (checking_time.getTime() <= earliest_time.getTime()) {
                earliest_time = checking_time;
                new_records.push([stream, closestIndex]);
            }
        }
    }

	// Play all records that start at the earliest found time
	for (let index = 0; index < new_records.length; index++) {
		let stream = new_records[index][0]
		if (stream.records[new_records[index][1]].starttime == earliest_time) {
			stream.current_index = new_records[index][1]
			stream.rec_pos = 0
			stream.active = true;
			listener(stream, true)
		}
	}
}

function slider_set_time_range(id, starttime, endtime) {
	const wrapper = document.querySelector(id);
	const input = wrapper.querySelector("input");
	
	input.max = (endtime.getTime() - starttime.getTime())/1000;
	input.starttime = starttime;
	input.endtime = endtime;
					
	if (input.curtime == 0) 
		input.curtime = endtime;
	else if (input.curtime > endtime)
		input.curtime = endtime;
	else if (input.curtime < starttime)
		input.curtime = starttime;
	
	input.value = (input.curtime.getTime() - starttime.getTime())/1000;
	
	_slider_draw_time_scale(id);
}

function _compare_records(a, b) {
	return a.starttime - b.starttime;
}

function slider_add_time_record(id, starttime, endtime, record_id, current_stream) {
	var record = {};
	
	record.starttime = starttime;
	record.endtime = endtime;
	
	if (record_id == null)
		record.id = current_stream.records.length;
	else
		record.id = record_id;
	
	current_stream.records.push(record);

	current_stream.records.sort(_compare_records);
	
	_slider_draw_time_marks(id);	
}

function _slider_draw_time_marks(id) {
    const wrapper = document.querySelector(id);
    const input = wrapper.querySelector("input");
    const range = input.max;
    const streams = active_streams;
	let marks = [];

    for (let index = 0; index < streams.length; index++) {
        let stream = streams[index];
        for (let i = 0; i < stream.records.length; i++) {
            if (stream.records[i].starttime < input.endtime && stream.records[i].endtime >= input.starttime) {
                let start = (stream.records[i].starttime.getTime() - input.starttime.getTime()) / 1000;
                let end = (stream.records[i].endtime.getTime() - input.starttime.getTime()) / 1000;

                if ((end - start) / range < 1 / 200)
                    end = range / 200 + start;

				marks.push({start: start * 100 / range, end: end * 100 / range});
            }
        }
    }

    marks.sort((a, b) => a.start - b.start);

    let bckg = "linear-gradient(to right, gray 0%, ";
    for (let mark of marks) {
        bckg += `gray ${mark.start}%, red ${mark.start}%, red ${mark.end}%, gray ${mark.end}%, `;
    }
    bckg += "gray 100%)";

    input.style.background = bckg;
}


function _slider_draw_time_scale(id) {
    const wrapper = document.querySelector(id);
    const input = wrapper.querySelector("input");
    const output_scale = wrapper.querySelector("output[name='scale']");
    const range = input.max;

    const lis = wrapper.querySelectorAll("li");

    var step = range / (lis.length - 1);
    for (var i = 0; i < lis.length; i++) {
        let time = new Date(input.starttime.getTime() + Math.round(step * i) * 1000);
        lis[i].innerText = time.toLocaleTimeString([], { timeStyle: 'short' });
    }

    if (range / 60 > 60)
        output_scale.textContent = Math.round((range / 60 / 60) * 100) / 100 + " hours";
    else
        output_scale.textContent = Math.round((range / 60)) + " minutes";
}
