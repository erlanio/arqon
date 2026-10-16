#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod native_files;

fn main() {
    native_files::run();
}
