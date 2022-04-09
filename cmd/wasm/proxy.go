package main

import (
  "encoding/json"
  "io/ioutil"
  "net/http"
  "strings"
)

type ProxyData struct {
  Session string `json:"session"`
  Path    string `json:"path"`
  Params  string `json:"params"`
}

func proxy(path string, params string) (string, error) {
  var proxyData ProxyData
  proxyData.Session = "random123456789"
  proxyData.Path = path
  proxyData.Params = params

  jsonData, err := json.Marshal(proxyData)
  if err != nil {
    return "", err
  }

  req, err := http.NewRequest("POST", "/proxy", strings.NewReader(string(jsonData)))
  if err != nil {
    return "", err
  }

  req.Header.Set("Content-Type", "application/json")

  resp, err := http.DefaultClient.Do(req)
  if err != nil {
    return "", err
  }
  defer resp.Body.Close()

  body, err := ioutil.ReadAll(resp.Body)
  if err != nil {
    return "", err
  }

  return string(body), nil
}
