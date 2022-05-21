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

func importMatch (w http.ResponseWriter, r *http.Request) {
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

func listMatches (w http.ResponseWriter, r *http.Request) {
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

func main() {
  r := mux.NewRouter()

  r.HandleFunc("/matches/", listMatches).Methods("GET")

  r.HandleFunc("/matches/import/{slug}/", importMatch).Methods("POST")

  r.PathPrefix("/matches/load/").Handler(http.StripPrefix("/matches/load/", http.FileServer(http.Dir("./db/"))))

  r.PathPrefix("/").Handler(http.FileServer(http.Dir("../static/")))

  srv := &http.Server{
    Handler: r,
    Addr: ":7860",
    WriteTimeout: 15 * time.Second,
    ReadTimeout: 15 * time.Second,
  }

  log.Fatal(srv.ListenAndServe())
}
