<?php
/**
 * InfinityFree-এ সাধারণত pdo_sqlite বন্ধ থাকে — তাই driver = 'auto' রাখলে
 * অ্যাপ নিজেই দেখে নেয়: MySQL কনফিগ পূরণ থাকলে MySQL, না হলে SQLite (থাকলে)।
 * ইনস্টলার (?p=install) নিজেই এই ফাইলটি তৈরি করে দিতে পারে — হাতে লেখার দরকার নেই।
 */
return [
    'app_name'   => 'কাজের হিসাব',
    'driver'     => 'auto',          // 'auto' | 'mysql' | 'sqlite'

    // ---- MySQL / MariaDB (InfinityFree: control panel → MySQL Databases) ----
    'mysql' => [
        'host'     => '',            // যেমন sql104.infinityfree.com
        'port'     => 3306,
        'database' => '',            // যেমন if0_12345678_kajerhisab
        'username' => '',            // যেমন if0_12345678
        'password' => '',
        'charset'  => 'utf8mb4',
    ],

    // ---- SQLite (যদি হোস্টিং-এ pdo_sqlite থাকে) ----
    'sqlite_path' => __DIR__ . '/data/app.sqlite',

    'timezone'     => 'Asia/Dhaka',
    'session_name' => 'KAJERHISAB',
    'debug'        => false,
];
