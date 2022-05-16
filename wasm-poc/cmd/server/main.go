package main

import (
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "strings"
)

func main() {
  proxy := func(w http.ResponseWriter, req *http.Request) {
    type ProxyData struct {
      Session string `json:"session"`
      Path    string `json:"path"`
      Params  string `json:"params"`
    }
    var jsonBody ProxyData
    if err := json.NewDecoder(req.Body).Decode(&jsonBody); err != nil {
      http.Error(w, err.Error(), http.StatusBadRequest)
      return
    }

    fmt.Printf("%s\n", fmt.Sprintf("https://academiegolf.com/%s", jsonBody.Path))
    req, err := http.NewRequest("POST", fmt.Sprintf("https://academiegolf.com/%s", jsonBody.Path), strings.NewReader(jsonBody.Params))
    if err != nil {
      http.Error(w, err.Error(), http.StatusBadRequest)
      return
    }

    req.Header.Add("Content-Type", "application/x-www-form-urlencoded")
    req.Header.Add("Cookie", fmt.Sprintf("sessxd=%s", jsonBody.Session))

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
      http.Error(w, err.Error(), http.StatusBadRequest)
      return
    }
    defer resp.Body.Close()

    io.Copy(w, resp.Body)
  }

  http.HandleFunc("/proxy", proxy)
  http.Handle("/", http.FileServer(http.Dir("../../assets")))

  err := http.ListenAndServe(":9090", nil)
  if err != nil {
    fmt.Println("Failed to start server", err)
    return
  }
}
