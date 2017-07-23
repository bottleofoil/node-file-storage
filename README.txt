A simple program that provides an HTTP API to store and retrieve files.

Supports the following features:

Upload a new file
Retrieve an uploaded file by name
Delete an uploaded file by name
If multiple files have the same contents, reuse the contents to save space

Starting
node main.js --port 8081

Check that it works as expected

echo "test content" >> /tmp/test-file.txt
curl -v http://localhost:8081/file1.txt --upload-file /tmp/test-file.txt
curl -v http://localhost:8081/file2.txt --upload-file /tmp/test-file.txt

curl -v http://localhost:8081/file2.txt
curl -vX "DELETE" http://localhost:8081/file2.txt

Check logs
journalctl --unit go-service-example

Check file storage
ls files-db/files
du -sh files-db/files

