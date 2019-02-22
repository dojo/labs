workflow "Pull Request Build" {
  on = "pull_request"
  resolves = ["Test"]
}

action "Install" {
  uses = "actions/npm@master"
  args = "install"
}

action "Bootstrap" {
  uses = "actions/npm@master"
  args = "run bootstrap"
  needs = ["Install"]
}

action "Test" {
  uses = "actions/npm@master"
  needs = ["Bootstrap"]
  args = "test"
}
