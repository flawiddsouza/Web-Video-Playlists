var store = {
    debug: false,
    state: {
        playlists: [],
        unfilteredPlaylists: [],
        clickedPlaylistName: ''
    },
    setPlaylistsAction(newValue) {
        if(this.debug) console.log('setPlaylistsAction triggered with', newValue)
        this.state.playlists = newValue
    },
    removePlaylistAction(playlist) {
        if(this.debug) console.log('removePlaylistAction triggered with', playlist)
        this.state.playlists.splice(this.state.playlists.indexOf(playlist), 1)
    },
    clearPlaylistsAction() {
        if(this.debug) console.log('clearPlaylistsAction triggered')
        this.state.playlists = []
    },
    filterPlaylistsAction(filter) {
        if(this.debug) console.log('removePlaylistAction triggered with', filter)
        if(this.state.unfilteredPlaylists.length == 0) {
            this.state.unfilteredPlaylists = this.state.playlists
        }
        if(filter != '') {
            this.state.playlists = this.state.unfilteredPlaylists.filter(playlist => playlist.name.toLowerCase().includes(filter))
            if(this.state.playlists.length == 0) {
                this.state.playlists = [ { name: "No Playlist Found", noContextMenu: true } ]
            }
        } else {
            this.state.playlists = this.state.unfilteredPlaylists
            this.state.unfilteredPlaylists = []
        }
    },
    sortPlaylistsAction(sortFunction) {
        if(this.debug) console.log('sortPlaylistsAction triggered with', sortFunction)
        this.state.playlists.sort(sortFunction)
    },
    reversePlaylistsAction() {
        if(this.debug) console.log('reversePlaylistsAction triggered')
        this.state.playlists.reverse()
    },
    setClickedPlaylistNameAction(newValue) {
        if(this.debug) console.log('setClickedPlaylistNameAction triggered with', newValue)
        this.state.clickedPlaylistName = newValue
    },
}

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

Vue.component('playlist-item', {
    props: ['playlist'],
    template: `
        <router-link :to="'/videos/' + playlist.id + '/' + playlist.name.replace(/[^a-zA-Z0-9-_]/g, '-')" :title="playlist.description" class="playlist" v-if="playlist.id">
            {{ playlist.name }}
        </router-link>
        <div class="playlist" v-else>
            {{ playlist.name }}
        </div>
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
            <div class="fixed">
                <div class="block-align-right">
                    <button @click="createPlaylist()" class="playlist-add">Add Playlist</button>
                </div>
                <input type="text" placeholder="Type to filter playlists..." class="playlists-filter" v-on:input="filterPlaylists" v-model="playlistsFilter">
                <div class="sorter">
                    <select v-model="sorterValue" @change="sorterValueChange">
                        <option disabled>Order by:</option>
                        <option>Add Date</option>
                        <option>Last Updated Date</option>
                        <option>Name</option>
                        <option>Last Added To</option>
                    </select>
                    <select v-model="sorterOrder" @change="sorterOrderChange">
                        <option>Ascending</option>
                        <option>Descending</option>
                    </select>
                </div>
                <router-link to="/videos" class="playlist playlist-solo">All Videos</router-link>
                <div class="separator"></div>
                <div class="make-scrollable">
                    <playlist-item v-for="playlist in playlists" :key="playlist.id" :playlist="playlist" @contextmenu.prevent.native="showContextMenu($event, playlist)" v-click-outside="hideContextMenu" v-if="!playlist.noContextMenu"></playlist-item>
                    <playlist-item :playlist="playlist" class="cursor-default" v-else></playlist-item>
                </div>
            </div>
        </div>
        <div id="playlists" v-else>No Playlists Found</div>
    `,
    data() {
        return {
            sharedState: store.state,
            loading: true,
            activePlaylist: {},
            playlistsFilter: '',
            sorterValue: 'Last Added To',
            sorterOrder: 'Descending'
        }
    },
    computed: {
        playlists() {
            return this.sharedState.playlists
        }
    },
    created() {
        if(localStorage.getItem('playlistsSorterValue')) {
            this.sorterValue = localStorage.getItem('playlistsSorterValue')
        }
        if(localStorage.getItem('playlistsSorterOrder')) {
            this.sorterOrder = localStorage.getItem('playlistsSorterOrder')
        }
        this.fetchPlaylists()
    },
    methods: {
        fetchPlaylists() {
            axios.get('/playlists').then(response => {
                store.setPlaylistsAction(response.data)
                this.sortPlaylists()
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
                        store.removePlaylistAction(playlist)
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
        },
        filterPlaylists() {
            store.filterPlaylistsAction(this.playlistsFilter)
        },
        sortPlaylists() {
            if(this.sorterValue != 'Last Updated Date') {
                this.sorterValueChange()
            }
        },
        sorterValueChange() {
            localStorage.setItem('playlistsSorterValue', this.sorterValue)
            switch(this.sorterValue) {
                case 'Add Date':
                    store.sortPlaylistsAction(dynamicSort('-created_at'))
                    break
                case 'Last Updated Date':
                    store.sortPlaylistsAction(dynamicSort('-updated_at'))
                    break
                case 'Name':
                    store.sortPlaylistsAction(dynamicSort('-name'))
                    break
                case 'Last Added To':
                    store.sortPlaylistsAction(dynamicSort('-updated_at:1'))
                    break
            }
            if(this.sorterOrder == 'Ascending') {
                store.reversePlaylistsAction()
            }
        },
        sorterOrderChange() {
            localStorage.setItem('playlistsSorterOrder', this.sorterOrder)
            store.reversePlaylistsAction()
        }
    }
})

Vue.component('video-item', {
    props: ['video', 'index', 'playlists'],
    template: `
        <section class="video">
            <div class="video-thumbnail">
                <a :href="videoObj.source" target="_blank"><img :src="videoObj.thumbnail_local? '/static/thumbnails/' + videoObj.thumbnail_local : videoObj.thumbnail"></a>
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
            <div class="video-index">{{ index + 1 }}</div>
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
            <div class="videos-topbar">
                <div class="sorter">
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
                <div class="videos-header">{{ videos.length }} {{ videos.length != 1 ? 'videos' : 'video' }}</div>
            </div>
            <div class="videos-container">
                <video-item v-for="(video, index) in videos"
                            :key="video.id"
                            :video="video"
                            :index="index"
                            :playlists="playlists"
                            v-on:remove-video-component="removeVideoComponent(video)"></video-item>
            </div>
        </div>
        <div id="videos" v-else>No Videos Found</div>
    `,
    data() {
        return {
            sharedState: store.state,
            loading: true,
            videos: [],
            sorterValue: 'Last Updated Date',
            sorterOrder: 'Descending'
        }
    },
    computed: {
        playlists() {
            return this.sharedState.playlists
        }
    },
    created() {
        if(localStorage.getItem('videosSorterValue')) {
            this.sorterValue = localStorage.getItem('videosSorterValue')
        }
        if(localStorage.getItem('videosSorterOrder')) {
            this.sorterOrder = localStorage.getItem('videosSorterOrder')
        }
        this.fetchVideos()
    },
    watch: {
        '$route': 'fetchVideos'
    },
    methods: {
        fetchVideos() {
            let playlistId = this.$route.params.playlist_id
            axios.get(`/playlist/${playlistId}`).then(response => {
                let playlist = response.data
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
            scroll(0, 0)
        },
        removeVideoComponent(video) {
            this.videos.splice(this.videos.indexOf(video), 1)
        },
        sortVideos() {
            if(this.sorterValue != 'Last Updated Date') {
                this.sorterValueChange()
            }
        },
        sorterValueChange() {
            localStorage.setItem('videosSorterValue', this.sorterValue)
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
            localStorage.setItem('videosSorterOrder', this.sorterOrder)
            this.videos.reverse()
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