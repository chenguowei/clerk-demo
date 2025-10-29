import axios from 'axios'

const apiClient = axios.create({
  baseURL: 'http://192.168.2.81:9080',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default apiClient
