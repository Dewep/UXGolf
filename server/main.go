package main

import (
  "net/http"
  "log"
  "time"
  "regexp"
  "os"
  "io/ioutil"
  "github.com/gorilla/mux"
)

func importMatch (w http.ResponseWriter, r *http.Request) {
  slugValidation := regexp.MustCompile(`^[A-Za-z]{20,50}$`).MatchString

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

func main() {
  r := mux.NewRouter()

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
