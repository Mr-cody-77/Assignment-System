# Assignment System

## Using Docker for this Project

This guide provides steps on how to import and run the Docker container for the Assignment System.

### Prerequisites
- Ensure you have [Docker](https://docs.docker.com/get-docker/) installed and running on your system.

### 1. Import the Container Image
If you have the Docker image saved as a `.tar` file, you can import (load) it into your local Docker environment.

Open your terminal or command prompt and run:
```bash
docker load -i assignment_system_image.tar
```
*(Note: Replace `assignment_system_image.tar` with the actual name of your tar file if it differs.)*

To verify that the image has been successfully imported, you can list your Docker images:
```bash
docker images
```
You should see the imported image in the list.

### 2. Run the Container
Once the image is loaded, you can run the container using the `docker run` command.

```bash
docker run -d -p 8080:8080 --name assignment_system_container <image_name>
```
- `-d`: Runs the container in detached mode (in the background).
- `-p 8080:8080`: Maps port 8080 on your host machine to port 8080 inside the container. Adjust these ports if your application uses a different port.
- `--name`: Assigns a custom name (`assignment_system_container`) to your running container.
- `<image_name>`: Replace this with the actual name/tag of the image you imported (e.g., `assignment_system:latest`).

### 3. Verify the Container is Running
To check the status of your running container:
```bash
docker ps
```
You should see `assignment_system_container` in the list of running containers. 

### 4. Stopping and Starting the Container
To stop the running container:
```bash
docker stop assignment_system_container
```

To start the container again:
```bash
docker start assignment_system_container
```

### 5. Viewing Logs (Optional)
If you need to troubleshoot or view the application's output, you can check the container logs:
```bash
docker logs assignment_system_container
```
