terraform {
  required_version = ">= 1.6"

  backend "local" {}

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "4.7.0"
    }
  }
}

provider "docker" {}
