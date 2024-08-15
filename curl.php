<?php
// create a new cURL resource
$ch = curl_init();

// set URL and other appropriate options
curl_setopt($ch, CURLOPT_URL, $_POST["text"]);
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_ANY);

// grab URL and pass it to the browser
$result = curl_exec($ch);

// close cURL resource, and free up system resources
curl_close($ch);

return $result;
?>

