import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuid } from "uuid";

export async function uploadReferenceImage(file: File, userId: string) {
  const id = uuid();
  const ext = file.name.split(".").pop();

  const storageRef = ref(storage, `reference/${userId}/${id}.${ext}`);

  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);

  return url;
}
