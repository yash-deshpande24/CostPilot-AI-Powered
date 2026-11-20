module "network" {
  source      = "../../modules/vpc"
  name        = "${var.project_name}-${var.environment}"
  cidr_block  = "10.40.0.0/16"
}
