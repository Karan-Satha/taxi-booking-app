<?php
// Connect to database
$conn = mysqli_connect('localhost', 'karan', 'karan1983', 'taxi_db');

// Check connection
if (!$conn) {
    echo "connection error" . mysqli_connect_error();
}