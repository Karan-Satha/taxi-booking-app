<?php
// Connect to database
$conn = mysqli_connect('localhost', '*******', '********', 'taxi_db');

// Check connection
if (!$conn) {
    echo "connection error" . mysqli_connect_error();
}
