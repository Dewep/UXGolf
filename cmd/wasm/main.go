package main

import (
  "encoding/json"
  "fmt"
  "syscall/js"
)

func main() {
  js.Global().Set("formatJSON", formatJSON())
  js.Global().Set("connect", promiseWrapper(connect))

  <-make(chan bool)
}

type promiseWrapperFunction func(this js.Value, args []js.Value) (interface{}, error)

func promiseWrapper(function promiseWrapperFunction) js.Func {
  return js.FuncOf(func(this js.Value, args []js.Value) interface{} {
    handler := js.FuncOf(func(promiseThis js.Value, promiseArgs []js.Value) interface{} {
      resolve := promiseArgs[0]
      reject := promiseArgs[1]

      go func() {
        result, err := function(this, args)
        if err != nil {
          reject.Invoke(err.Error())
        } else {
          resolve.Invoke(result)
        }
      }()

      return nil
    })

    promiseConstructor := js.Global().Get("Promise")
    return promiseConstructor.New(handler)
  })
}

func formatJSON() js.Func {
  jsonFunc := js.FuncOf(func(this js.Value, args []js.Value) interface{} {
    if len(args) != 1 {
      return "Invalid no of arguments passed"
    }

    jsDoc := js.Global().Get("document")
    if !jsDoc.Truthy() {
      return "Unable to get document object"
    }

    jsonOuputTextArea := jsDoc.Call("getElementById", "jsonoutput")
    if !jsonOuputTextArea.Truthy() {
      return "Unable to get output text area"
    }

    inputJSON := args[0].String()
    fmt.Printf("input %s\n", inputJSON)

    pretty, err := prettyJson(inputJSON)
    if err != nil {
      errStr := fmt.Sprintf("unable to parse JSON. Error %s occurred\n", err)
      return errStr
    }

    jsonOuputTextArea.Set("value", pretty)

    return nil
  })

  return jsonFunc
}

func prettyJson(input string) (string, error) {
  var raw interface{}
  if err := json.Unmarshal([]byte(input), &raw); err != nil {
    return "", err
  }

  pretty, err := json.MarshalIndent(raw, "", "  ")
  if err != nil {
    return "", err
  }

  return string(pretty), nil
}
