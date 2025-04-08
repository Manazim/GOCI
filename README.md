# GOCI (Guardian Of Critical Infrastructure)

## Overview

The GOCI system utilizes the **React** framework for the dashboard. For the Kubernetes setup, we use **Minikube** as our prototype testing environment. Additionally, refer to the **Simulation** folder to mimic sensor data from the real water pipe system.

For training the models in failure prediction and maintenance prediction, please see the file named **AI Inference Model**.

## Minikube

### Initial Setup

**Requirements:**

- Minikube installer
- Docker

**Setup Instructions:**

1. Watch this helpful [YouTube tutorial](https://www.youtube.com/watch?v=CjZ646SZDNU) on setting up Minikube.
2. After installing the necessary tools, boot up Minikube locally. *(If you encounter issues during setup, consider downgrading Minikube to version v1.33.1.)*

Execute the following command to start Minikube using Hyper-V as the driver:

```bash
minikube start --driver=hyperv
```

To check the node IP, run:

```bash
minikube node
```

### Deployment

For this project, four pods are required. Create a folder for each pod. For example, under the **GOCI** directory, create these folders:

- **Analyze**
- **Predict**
- **Dashboard**
- **Ingress**

Each folder should contain a file named `Dockerfile` that builds a custom image for use in Minikube. Refer to our setup for a sample configuration.

#### Building and Pushing the Docker Image

1. **Build the Image:**

   Navigate to the appropriate folder and run:

   ```bash
   docker build --no-cache -t data-predict:latest .
   ```

2. **Push the Image to Docker Hub:**

   Since the Docker environments on your local machine and in Minikube are separate, you need to push your custom image to a repository.

   - First, log in to your Docker account:

     ```bash
     docker login
     ```

   - Tag the Docker image:

     ```bash
     docker tag data-predict manzim/data-predict:latest
     ```

   - Push the image:

     ```bash
     docker push manzim/data-predict
     ```

#### Deploying to Minikube

Minikube uses YAML configuration files for deployments. For a sample configuration, refer to the **k8s** folder in this repository.

Deploy your pod and service with:

```bash
kubectl apply -f deploy_configuration_file_name.yaml
kubectl apply -f service_configuration_file_name.yaml
```

Verify the deployment with:

```bash
kubectl get services
kubectl get pods
```

These commands display detailed information about your deployment, including service IPs, restart counts, and the current state of each pod.

## Dashboard

To set up the dashboard:

1. Navigate to the root directory.
2. Remove the existing `package-lock.json` file and `node_modules` folder:

   ```bash
   rm -rf package-lock.json node_modules
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Build the project (the standard command is usually `npm run build`):

   ```bash
   npm run build
   ```
