use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::exit;

use clap::Parser;
use salvo::fs::NamedFile;
use salvo::prelude::*;
use walkdir::WalkDir;

fn display_host(host: &str) -> String {
    if host == "0.0.0.0" {
        local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".into())
    } else {
        host.to_string()
    }
}

type FileMap = HashMap<PathBuf, String>;

fn hash_file(path: &Path) -> std::io::Result<String> {
    use sha2::{Digest, Sha256};

    let mut file = std::fs::File::open(path)?;

    let mut hasher = Sha256::new();

    let mut buf = [0u8; 8192];

    loop {
        let n = file.read(&mut buf)?;

        if n == 0 {
            break;
        }

        hasher.update(&buf[..n]);
    }

    let hash = hasher.finalize();

    Ok(hash.iter().map(|b| format!("{:02x}", b)).collect())
}

fn parse_dir(s: &str) -> Result<(String, PathBuf, FileMap), String> {
    let dir = std::fs::canonicalize(s).map_err(|e| format!("{s}: {e}"))?;

    if !dir.is_dir() {
        return Err(format!("{s} is not a directory"));
    }

    let name = dir
        .file_name()
        .and_then(|x| x.to_str())
        .ok_or_else(|| format!("invalid directory name: {}", dir.display()))?
        .to_string();

    let mut files = HashMap::new();

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

        let hash = hash_file(full).map_err(|e| e.to_string())?;

        files.insert(rel, hash);
    }

    Ok((name, dir, files))
}

#[derive(Parser, Debug)]
#[command(author, version, about, arg_required_else_help = true)]
struct Opts {
    #[arg(long, required = true, num_args = 1.., value_parser = parse_dir)]
    dirs: Vec<(String, PathBuf, FileMap)>,
    #[arg(long, default_value = "0.0.0.0")]
    host: String,
    #[arg(long, default_value_t = 8698)]
    port: u16,
}

#[handler]
async fn list(
    req: &mut Request,
    depot: &mut Depot,
) -> (Json<HashMap<PathBuf, String>>, StatusCode) {
    let dirs = depot
        .obtain::<HashMap<String, (PathBuf, FileMap)>>()
        .unwrap();
    let name = req.param::<String>("name").unwrap();

    if let Some(file_map) = dirs.get(&name).map(|v| &v.1) {
        (Json(file_map.clone()), StatusCode::OK)
    } else {
        (Json(HashMap::default()), StatusCode::NOT_FOUND)
    }
}

#[handler]
async fn download(req: &mut Request, depot: &mut Depot) -> Result<NamedFile, StatusCode> {
    let dirs = depot
        .obtain::<HashMap<String, (PathBuf, FileMap)>>()
        .unwrap();
    let name = req.param::<String>("name").unwrap();
    let file_name = req.param::<String>("file_name").unwrap();

    if let Some((path, _file_map)) = dirs.get(&name) {
        match NamedFile::open(path.join(file_name)).await {
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
    let Opts { dirs, port, host } = Opts::parse();

    let mut dir_map: HashMap<String, (PathBuf, FileMap)> = HashMap::new();

    for (name, path, file_map) in dirs {
        if dir_map.insert(name.clone(), (path, file_map)).is_some() {
            eprintln!("Duplicate directory base name detected: '{}'", name);
            exit(1);
        }
    }

    let list_router = Router::with_path("/list/{name}")
        .hoop(affix_state::inject(dir_map.clone()))
        .get(list);

    let download_router = Router::with_path("/download/{name}/{file_name}")
        .hoop(affix_state::inject(dir_map))
        .get(download);

    let router = Router::new().push(list_router).push(download_router);

    let display_host = display_host(&host);
    println!("Server running! Listening on http://{display_host}:{port}");

    Server::new(TcpListener::new((host, port)).bind().await)
        .serve(router)
        .await;
}
