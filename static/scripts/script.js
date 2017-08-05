Vue.directive('click-outside', {
    bind(el, binding, vnode) {
        el.event = event => {
            // here I check that click was outside the el and its children
            if (!(el == event.target || el.contains(event.target))) {
                // and if it did, call method provided in attribute value
                vnode.context[binding.expression](event)
            }
        }
        document.body.addEventListener('click', el.event)
    },
    unbind(el) {
        document.body.removeEventListener('click', el.event)
    },
})

Vue.component('video-item', {
    props: ['video', 'playlists'],
    template: `
        <section class="video">
            <div class="video-thumbnail">
                <a :href="videoObj.source" target="_blank"><img :src="videoObj.thumbnail"></a>
                <p>{{ videoObj.duration }}</p>
            </div>
            <div class="video-metadata">
                <div class="video-metadata-heading">
                    <a :href="videoObj.source" target="_blank" v-if="!editVideoBool">{{ videoObj.title }}</a>
                    <span v-else>
                        <input type="text" v-model="editVideoObj.title">
                        <input type="text" v-model="editVideoObj.source">
                    </span>
                </div>
                <div class="video-metadata-subheading">
                    <a :href="videoObj.uploader_url" v-if="!editVideoBool">{{ videoObj.uploader }}</a>
                    <span v-else>
                        <input type="text" v-model="editVideoObj.uploader">
                        <input type="text" v-model="editVideoObj.uploader_url">
                    </span>
                </div>
                <div class="video-metadata-date">Published on
                    <span v-if="!editVideoBool">{{ momentDateTime(videoObj.published_at) }}</span>
                    <input type="text" v-model="editVideoObj.published_at" v-else>
                </div>
                <div class="video-metadata-description" v-html="videoObj.description.replace(/(https?:.*)/g, '<a href=$1>$1</a>')" v-if="!editVideoBool"></div>
                <div class="video-metadata-description" v-else>
                    <textarea v-model="editVideoObj.description"></textarea>
                </div>
                <div class="video-note" v-if="videoObj.note && !editVideoBool">Note: {{ videoObj.note }}</div>
                <div class="video-note" v-if="editVideoBool">
                    Note<br>
                    <textarea v-model="editVideoObj.note"></textarea>
                </div>
                <div class="video-tags" v-if="videoObj.tags && !editVideoBool">Tags: {{ videoObj.tags }}</div>
                <div class="video-tags" v-if="editVideoBool">
                    Tags<br>
                    <input v-model="editVideoObj.tags"></input>
                </div>
                <div class="video-metadata-date">Added on {{ momentDateTime(videoObj.created_at) }}</div>
                <div class="video-metadata-date">Last Updated on {{ momentDateTime(videoObj.updated_at) }}</div>
                <div class="video-actions">
                    <button @click="enableChangePlaylist" v-if="!changePlaylistBool">Change Playlist</button>
                    <div class="video-action" v-else>
                        <select ref="changePlaylistSelect">
                            <option v-for="playlist in playlists" :value="playlist.id" :selected="playlist.id == videoObj.playlist_id">{{ playlist.name }}</option>
                        </select>
                        <button @click="changePlaylist" class="button-green">Save</button>
                        <button @click="changePlaylistBool = false">Cancel</button>
                    </div>
                    <button @click="enableEditVideo" v-if="!editVideoBool">Edit</button>
                    <div class="video-action" v-else>
                        <button @click="editVideo" class="button-green">Update</button>
                        <button @click="cancelEditVideo">Cancel</button>
                    </div>
                    <button @click="enableDeleteVideo" class="button-red" v-if="!deleteVideoBool">Delete</button>
                    <div class="video-action" v-else>
                        <span>Are you sure?</span>
                        <button @click="deleteVideo" class="button-red">Yes</button>
                        <button @click="deleteVideoBool = false">Cancel</button>
                    </div>
                </div>
            </div>
        </section>
    `,
    data() {
        return {
            changePlaylistBool: false,
            editVideoBool: false,
            deleteVideoBool: false,
            videoObj: JSON.parse(JSON.stringify(this.video)),
            editVideoObj: JSON.parse(JSON.stringify(this.video))
        }
    },
    methods: {
        momentDateTime(dateTime) {
            return moment.utc(dateTime).local().format('MMM D, YYYY h:mm A')
        },
        enableChangePlaylist() {
            this.editVideoBool = false
            this.changePlaylistBool = true
            this.deleteVideoBool = false
        },
        changePlaylist() {
            let select = this.$refs.changePlaylistSelect
            let selectedPlaylistId = select.options[select.selectedIndex].value
            if(this.video.playlist_id != selectedPlaylistId) {
                axios.post('/edit-video', { playlist_id: selectedPlaylistId, id: this.video.id }).then(response => {
                    let result = response.data
                    if(result.status == 'success') {
                        this.$emit('remove-video-component');
                    } else {
                        alert(result.message)
                    }
                })
            }
            this.changePlaylistBool = false
        },
        enableEditVideo() {
            this.editVideoBool = true
            this.changePlaylistBool = false
            this.deleteVideoBool = false
        },
        editVideo() {
            this.editVideoBool = false
            let editedVideo = this.editVideoObj
            let dataToSend = {}
            if(editedVideo['title'] != this.videoObj.title) {
                dataToSend['title'] = editedVideo['title']
            }
            if(editedVideo['source'] != this.videoObj.source) {
                dataToSend['source'] = editedVideo['source']
            }
            if(editedVideo['uploader'] != this.videoObj.uploader) {
                dataToSend['uploader'] = editedVideo['uploader']
            }
            if(editedVideo['uploader_url'] != this.videoObj.uploader_url) {
                dataToSend['uploader_url'] = editedVideo['uploader_url']
            }
            if(editedVideo['published_at'] != this.videoObj.published_at) {
                dataToSend['published_at'] = editedVideo['published_at']
            }
            if(editedVideo['description'] != this.videoObj.description) {
                dataToSend['description'] = editedVideo['description']
            }
            if(editedVideo['duration'] != this.videoObj.duration) {
                dataToSend['duration'] = editedVideo['duration']
            }
            if(editedVideo['note'] != this.videoObj.note) {
                dataToSend['note'] = editedVideo['note']
            }
            if(editedVideo['tags'] != this.videoObj.tags) {
                dataToSend['tags'] = editedVideo['tags']
            }
            if(!(Object.keys(dataToSend).length === 0 && dataToSend.constructor === Object)) {
                dataToSend['id'] = this.video.id
                axios.post('/edit-video', dataToSend).then(response => {
                    let result = response.data
                    if(result.status == 'success') {
                        this.videoObj = this.editVideoObj
                        this.videoObj['updated_at'] = moment.utc()
                    } else {
                        alert(result.message)
                    }
                })
            }
        },
        cancelEditVideo() {
            this.editVideoBool = false
            this.editVideoObj = JSON.parse(JSON.stringify(this.videoObj))
        },
        enableDeleteVideo() {
            this.editVideoBool = false
            this.changePlaylistBool = false
            this.deleteVideoBool = true
        },
        deleteVideo() {
            axios.post('/delete-video', { id: this.video.id }).then(response => {
                let result = response.data
                if(result.status == 'success') {
                    this.$emit('remove-video-component');
                } else {
                    alert(result.message)
                }
            })
        }
    }
})

let videos = Vue.component('videos', {
    template: `
        <div id="videos" v-if="loading">Loading videos...</div>
        <div id="videos" v-else-if="videos.length > 0">
            <div id="sorter">
                <select v-model="sorterValue" @change="sorterValueChange">
                    <option disabled>Order by:</option>
                    <option>Add Date</option>
                    <option>Last Updated Date</option>
                    <option>Title</option>
                    <option>Uploader</option>
                    <option>Published On</option>
                </select>
                <select v-model="sorterOrder" @change="sorterOrderChange">
                    <option>Ascending</option>
                    <option>Descending</option>
                </select>
            </div>
            <video-item v-for="video in videos"
                        :key="video.id"
                        :video="video"
                        :playlists="playlists"
                        v-on:remove-video-component="removeVideoComponent(video)"></video-item>
        </div>
        <div id="videos" v-else>No Videos Found</div>
    `,
    data() {
        return {
            loading: true,
            videos: [],
            playlists: [],
            sorterValue: 'Last Updated Date',
            sorterOrder: 'Descending'
        }
    },
    created() {
        if(localStorage.getItem('sorterValue')) {
            this.sorterValue = localStorage.getItem('sorterValue')
        }
        if(localStorage.getItem('sorterOrder')) {
            this.sorterOrder = localStorage.getItem('sorterOrder')
        }
        this.fetchData()
    },
    watch: {
        '$route': 'fetchData'
    },
    methods: {
        fetchVideos() {
            let playlistId = this.$route.params.playlist_id
            axios.get(`/playlist/${playlistId}`).then(response => {
                playlist = response.data
                if(playlist) {
                    document.title = playlist.name + ' | ' + 'Web Video Playlists'
                } else {
                    document.title = 'All Videos | Web Video Playlists'
                }
            })
            if(playlistId) {
                axios.get(`/videos/${playlistId}`).then(response => {
                    this.videos = response.data
                    this.sortVideos()
                    this.loading = false
                }).catch(error => {
                    console.log(error)
                    this.videos = []
                    this.loading = false
                })
            }
            let routePath = this.$route.path
            if(routePath == '/videos') {
                axios.get('/videos').then(response => {
                    this.videos = response.data
                    this.loading = false
                })
            }
        },
        fetchPlaylists() {
            axios.get('/playlists').then(response => {
                this.playlists = response.data
            })
        },
        removeVideoComponent(video) {
            this.videos.splice(this.videos.indexOf(video), 1)
        },
        fetchData() {
            this.fetchVideos()
            this.fetchPlaylists()
        },
        sortVideos() {
            if(this.sorterValue != 'Last Updated Date') {
                this.sorterValueChange()
            }
        },
        sorterValueChange() {
            localStorage.setItem('sorterValue', this.sorterValue)
            function dynamicSort(property) { // giving this a -property will sort in descending order | Ex: dynamicSort('-created_at')
                let sortOrder = 1
                if(property[0] === "-") {
                    sortOrder = -1
                    property = property.substr(1)
                }
                return function(a,b) {
                    var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0
                    return result * sortOrder
                }
            }
            switch(this.sorterValue) {
                case 'Add Date':
                    this.videos.sort(dynamicSort('-created_at'))
                    break
                case 'Last Updated Date':
                    this.videos.sort(dynamicSort('-updated_at'))
                    break
                case 'Title':
                    this.videos.sort(dynamicSort('-title'))
                    break
                case 'Uploader':
                    this.videos.sort(dynamicSort('-uploader'))
                    break
                case 'Published On':
                    this.videos.sort(dynamicSort('-published_at'))
                    break
            }
            if(this.sorterOrder == 'Ascending') {
                this.videos.reverse()
            }
        },
        sorterOrderChange() {
            localStorage.setItem('sorterOrder', this.sorterOrder)
            this.videos.reverse()
        }
    }
})

Vue.component('playlist-item', {
    props: ['name', 'description'],
    template: `
        <section class="playlist" :title="description">
            {{ name }}
        </section>
    `
})

Vue.component('playlists', {
    template: `
        <div id="playlists" v-if="loading">Loading playlists...</div>
        <div id="playlists" v-else-if="playlists.length > 0">
            <div class="context-menu" ref="ctx">
                <ul>
                    <li @click="renamePlaylist(activePlaylist)">Rename</li>
                    <li @click="deletePlaylist(activePlaylist)">Delete</li>
                </ul>
            </div>
            <router-link v-for="playlist in playlists" :key="playlist.id" :to="'/videos/' + playlist.id + '/' + playlist.name" class="playlist-link">
                <playlist-item :name="playlist.name" :description="playlist.description" @contextmenu.prevent.native="showContextMenu($event, playlist)"  v-click-outside="hideContextMenu"></playlist-item>
            </router-link>
            <router-link to="/videos" class="playlist-link">
                <playlist-item name="All Videos"></playlist-item>
            </router-link>
            <a @click="createPlaylist()" class="playlist-link">
                <playlist-item name="+"></playlist-item>
            </a>
        </div>
        <div id="playlists" v-else>No Playlists Found</div>
    `,
    data() {
        return {
            loading: true,
            playlists: [],
            activePlaylist: {}
        }
    },
    created() {
        this.fetchPlaylists()
    },
    watch: {
        '$route': 'fetchPlaylists'
    },
    methods: {
        fetchPlaylists() {
            axios.get('/playlists').then(response => {
                this.playlists = response.data
                this.loading = false
            })
        },
        createPlaylist() {
            let playlistName = prompt("Enter new playlist name")
            if(playlistName) {
                axios.post('/add-playlist', { name: playlistName }).then(response => {
                    let result = response.data
                    if(result.status == 'success') {
                        this.fetchPlaylists()
                    } else {
                        alert(result.message)
                    }
                })
            }
        },
        renamePlaylist(playlist) {
            let playlistName = prompt("Enter new playlist name", playlist.name)
            if(playlistName) {
                axios.post('/edit-playlist', { name: playlistName, id: playlist.id }).then(response => {
                    let result = response.data
                    if(result.status == 'success') {
                        this.fetchPlaylists()
                        if(document.location.hash == `#/videos/${playlist.id}/${playlist.name}`) {
                            router.push(`/videos/${playlist.id}/${playlistName}`)
                        }
                    } else {
                        alert(result.message)
                    }
                })
            }
        },
        deletePlaylist(playlist) {
            if(confirm("Are you sure you want to delete this playlist? Deleting a playlist will also delete all the videos under it!")) {
                axios.post('/delete-playlist', { id: playlist.id }).then(response => {
                    let result = response.data
                    if(result.status == 'success') {
                        this.playlists.splice(this.playlists.indexOf(playlist), 1)
                        if(document.location.hash == `#/videos/${playlist.id}/${playlist.name}`) {
                            router.push('/videos')
                        }
                    } else {
                        alert(result.message)
                    }
                })
                
            }
        },
        showContextMenu(e, playlist) {
            this.$refs.ctx.style.display = 'block'
            this.$refs.ctx.style.left = e.pageX + "px"
            this.$refs.ctx.style.top = e.pageY + "px"
            this.activePlaylist = playlist
        },
        hideContextMenu() {
            this.$refs.ctx.style.display = 'none'
        }
    }
})

const router = new VueRouter({
    routes: [
        { path: '/videos', component: videos },
        { path: '/videos/:playlist_id/:playlist_name?', component: videos }
    ]
})

new Vue({
    el: '#app',
    router
})

if(document.location.hash == '/' || document.location.hash == '#/') {
    router.push('/videos/1/Watch Later')
}