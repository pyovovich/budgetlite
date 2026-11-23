variable "budgetlite_image_id" {
  description = "ID de la imagen de BudgetLite disponible en el motor Docker local."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^sha256:[0-9a-f]{64}$", var.budgetlite_image_id))
    error_message = "Usá el ID completo devuelto por docker image inspect."
  }
}

resource "docker_network" "budgetlite" {
  name = "budgetlite-tf"
}

resource "docker_volume" "prometheus" {
  name = "budgetlite-tf-prometheus"
}

resource "docker_volume" "grafana" {
  name = "budgetlite-tf-grafana"
}

resource "docker_image" "prometheus" {
  name         = "prom/prometheus:v3.5.0"
  keep_locally = true
}

resource "docker_image" "grafana" {
  name         = "grafana/grafana:12.1.1"
  keep_locally = true
}

resource "docker_container" "budgetlite" {
  name  = "budgetlite-tf-app"
  image = var.budgetlite_image_id
  wait  = true

  networks_advanced {
    name    = docker_network.budgetlite.name
    aliases = ["budgetlite"]
  }

  ports {
    ip       = "127.0.0.1"
    internal = 3000
    external = 13000
  }

  healthcheck {
    test         = ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/readyz').then(res => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"]
    interval     = "2s"
    timeout      = "2s"
    retries      = 10
    start_period = "5s"
  }
}

resource "docker_container" "prometheus" {
  name  = "budgetlite-tf-prometheus"
  image = docker_image.prometheus.image_id

  networks_advanced {
    name    = docker_network.budgetlite.name
    aliases = ["prometheus"]
  }

  ports {
    ip       = "127.0.0.1"
    internal = 9090
    external = 19090
  }

  volumes {
    volume_name    = docker_volume.prometheus.name
    container_path = "/prometheus"
  }

  upload {
    file    = "/etc/prometheus/prometheus.yml"
    content = <<-YAML
      global:
        scrape_interval: 15s
      scrape_configs:
        - job_name: budgetlite
          static_configs:
            - targets: ["budgetlite:3000"]
    YAML
  }
}

resource "docker_container" "grafana" {
  name  = "budgetlite-tf-grafana"
  image = docker_image.grafana.image_id

  networks_advanced {
    name = docker_network.budgetlite.name
  }

  ports {
    ip       = "127.0.0.1"
    internal = 3000
    external = 13001
  }

  volumes {
    volume_name    = docker_volume.grafana.name
    container_path = "/var/lib/grafana"
  }

  upload {
    file    = "/etc/grafana/provisioning/datasources/prometheus.yaml"
    content = <<-YAML
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          access: proxy
          url: http://prometheus:9090
          isDefault: true
    YAML
  }
}
