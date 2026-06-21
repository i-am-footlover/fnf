use std::collections::HashSet;
use std::path::PathBuf;

use clap::Parser;
use qrcode::{QrCode, render::unicode};
use salvo::fs::NamedFile;
use salvo::prelude::*;
use walkdir::WalkDir;

fn to_local_ip(host: &str) -> String {
    if host == "0.0.0.0" {
        local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".into())
    } else {
        host.to_string()
    }
}

fn parse_dir(s: &str) -> Result<(String, PathBuf, HashSet<PathBuf>), String> {
    let dir = std::fs::canonicalize(s).map_err(|e| format!("{s}: {e}"))?;

    if !dir.is_dir() {
        return Err(format!("{s} is not a directory"));
    }

    let name = dir
        .file_name()
        .and_then(|x| x.to_str())
        .ok_or_else(|| format!("invalid directory name: {}", dir.display()))?
        .to_string();

    let mut files = HashSet::new();

    for entry in WalkDir::new(&dir) {
        let entry = entry.map_err(|e| e.to_string())?;

        if !entry.file_type().is_file() {
            continue;
        }

        let full = entry.path();

        let rel = full
            .strip_prefix(&dir)
            .map_err(|e| e.to_string())?
            .to_path_buf();

        files.insert(rel);
    }

    Ok((name, dir, files))
}

#[derive(Parser, Debug)]
#[command(author, version, about, arg_required_else_help = true)]
struct Opts {
    #[arg(required = true, value_parser = parse_dir)]
    dir: (String, PathBuf, HashSet<PathBuf>),
    #[arg(long, default_value = "0.0.0.0")]
    host: String,
    #[arg(long, default_value_t = 8698)]
    port: u16,
}

#[handler]
async fn list(depot: &mut Depot) -> (Json<HashSet<PathBuf>>, StatusCode) {
    let dirs = depot.obtain::<(PathBuf, HashSet<PathBuf>)>().unwrap();
    (Json(dirs.1.clone()), StatusCode::OK)
}

#[handler]
async fn download(req: &mut Request, depot: &mut Depot) -> Result<NamedFile, StatusCode> {
    let dirs = depot.obtain::<(PathBuf, HashSet<PathBuf>)>().unwrap();
    let rel_file_path = req.param::<PathBuf>("rel_file_path").unwrap();

    if let Some(rel_file_path) = dirs.1.get(&rel_file_path) {
        match NamedFile::open(dirs.0.join(rel_file_path)).await {
            Ok(file) => Ok(file),
            Err(salvo::Error::Io(err)) if err.kind() == std::io::ErrorKind::NotFound => {
                Err(StatusCode::NOT_FOUND)
            }
            Err(err) => {
                eprintln!("internal server error: {err}");
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().init();
    let Opts {
        dir: (name, path, rel_file_paths),
        port,
        host,
    } = Opts::parse();

    let list_router = Router::with_path("/list")
        .hoop(affix_state::inject((path.clone(), rel_file_paths.clone())))
        .get(list);

    let download_router = Router::with_path("/download/{rel_file_path}")
        .hoop(affix_state::inject((path.clone(), rel_file_paths.clone())))
        .get(download);

    let router = Router::new().push(list_router).push(download_router);

    let host = to_local_ip(&host);
    println!("Server running! Listening on http://{host}:{port}\n");

    let url = format!("scriptable:///run/fnf?host={host}&port={port}&name={name}&openEditor=true");
    println!("Scan the QR code below to sync with Scriptable.");
    let code = QrCode::new(&url).unwrap();
    let string = code.render::<unicode::Dense1x2>().build();
    println!("{}", string);
    println!("Scriptable URL: {}", url);

    Server::new(TcpListener::new((host, port)).bind().await)
        .serve(router)
        .await;
}
