package main

import (
  "errors"
  "syscall/js"
  "net/url"
  "fmt"
)

func connect(this js.Value, args []js.Value) (interface{}, error) {
  if len(args) != 2 {
    return nil, errors.New("Invalid arguments passed: email, password")
  }

  path := fmt.Sprintf("fr/pulnoy/mes-informations?tab=1")
  params := fmt.Sprintf("login=%s&password=%s&auth=1", url.PathEscape(args[0].String()), url.PathEscape(args[1].String()))

  body, err := proxy(path, params)
  if err != nil {
    return nil, err
  }

  return body, nil
}
