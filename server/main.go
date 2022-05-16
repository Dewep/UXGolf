package main

import (
  "net/http"
  "log"
  "time"
  "github.com/gorilla/mux"
)

func main() {
  r := mux.NewRouter()

  r.PathPrefix("/").Handler(http.FileServer(http.Dir("../static/")))

  srv := &http.Server{
    Handler: r,
    Addr: ":7860",
    WriteTimeout: 15 * time.Second,
    ReadTimeout: 15 * time.Second,
  }

  log.Fatal(srv.ListenAndServe())
}
