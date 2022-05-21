package main

import (
  "fmt"
  "net/http"
  "log"
  "time"
  "regexp"
  "os"
  "io/ioutil"
  "github.com/gorilla/mux"
  "encoding/json"
)

var version = "VERSION"

var epoch = time.Unix(0, 0).Format(time.RFC1123)
var noCacheHeaders = map[string]string{
  "Expires":         epoch,
  "Cache-Control":   "no-cache, private, max-age=0",
  "Pragma":          "no-cache",
  "X-Accel-Expires": "0",
}
var etagHeaders = []string{
  "ETag",
  "If-Modified-Since",
  "If-Match",
  "If-None-Match",
  "If-Range",
  "If-Unmodified-Since",
}

func NoCacheHeaders(w http.ResponseWriter, r *http.Request) {
  // Delete any ETag headers that may have been set
  for _, v := range etagHeaders {
    if r.Header.Get(v) != "" {
      r.Header.Del(v)
    }
  }

  // Set our NoCache headers
  for k, v := range noCacheHeaders {
    w.Header().Set(k, v)
  }
}

func NoCache(h http.Handler) http.Handler {
  fn := func(w http.ResponseWriter, r *http.Request) {
    NoCacheHeaders(w, r)
    h.ServeHTTP(w, r)
  }

  return http.HandlerFunc(fn)
}

func importMatch(w http.ResponseWriter, r *http.Request) {
  slugValidation := regexp.MustCompile(`^[A-Za-z0-9]{20,50}$`).MatchString

  vars := mux.Vars(r)
  slug := vars["slug"]

  if !slugValidation(slug) {
    http.Error(w, "Invalid slug", http.StatusBadRequest)
    return
  }

  file, err := os.Create("./db/" + slug + ".json")
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  defer file.Close()

  body, err := ioutil.ReadAll(r.Body)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  _, err = file.Write(body)
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.WriteHeader(http.StatusOK)
}

func listMatches(w http.ResponseWriter, r *http.Request) {
  matches, err := ioutil.ReadDir("./db/")
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  w.WriteHeader(http.StatusOK)

  // Result must be an JSON array
  // Self-construct the JSON response, to simplify the process
  w.Write([]byte("{\"matches\":["))
  for _, match := range matches {
    if match.IsDir() {
      continue
    }

    // Only if the file is a .json file
    if match.Name()[len(match.Name())-5:] != ".json" {
      continue
    }

    // Read the file
    file, err := os.Open("./db/" + match.Name())
    if err != nil {
      fmt.Println(err.Error())
      continue
    }
    defer file.Close()

    // Parse file into JSON
    body, err := ioutil.ReadAll(file)
    if err != nil {
      fmt.Println(err.Error())
      continue
    }

    // Parse body as {"date":"...","player":"...","index":54,"course":"...","starter":"..."}
    var matchData map[string]interface{}
    err = json.Unmarshal(body, &matchData)
    if err != nil {
      fmt.Println(err.Error())
      continue
    }

    matchSlug := match.Name()[:len(match.Name())-5]

    jsonRow := fmt.Sprintf("{\"slug\":\"%s\",\"date\":\"%s\",\"player\":\"%s\",\"index\":%d,\"course\":\"%s\",\"starter\":\"%s\"},", matchSlug, matchData["date"], matchData["player"], int(matchData["index"].(float64)), matchData["course"], matchData["starter"])
    w.Write([]byte(jsonRow))
  }
  w.Write([]byte("null]}")) // Null at the end, to simplify the JSON result
}

func loadIndex(w http.ResponseWriter, r *http.Request) {
  // Load static/index.html
  index, err := ioutil.ReadFile("../static/index.html")
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
  }

  // Replace all the VERSION strings with the current version
  index = []byte(regexp.MustCompile("VERSION").ReplaceAllString(string(index), version))

  w.Header().Set("Content-Type", "text/html")
  NoCacheHeaders(w, r)
  w.WriteHeader(http.StatusOK)
  w.Write(index)
}

func main() {
  versionFile, err := ioutil.ReadFile("../.git/refs/heads/master")
  if err != nil {
    log.Fatal(err)
  }
  version = string(versionFile[:8])

  r := mux.NewRouter()

  r.HandleFunc("/matches/", listMatches).Methods("GET")

  r.HandleFunc("/matches/import/{slug}/", importMatch).Methods("POST")

  r.PathPrefix("/matches/load/").Handler(NoCache(http.StripPrefix("/matches/load/", http.FileServer(http.Dir("./db/")))))

  r.HandleFunc("/", loadIndex).Methods("GET")
  r.PathPrefix("/").Handler(NoCache(http.FileServer(http.Dir("../static/"))))

  srv := &http.Server{
    Handler: r,
    Addr: ":7860",
    WriteTimeout: 15 * time.Second,
    ReadTimeout: 15 * time.Second,
  }

  log.Fatal(srv.ListenAndServe())
}
